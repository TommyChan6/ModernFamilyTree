<template>
  <div class="codex" :class="['cx-' + (store.isLightTheme ? 'light' : 'dark')]">
    <!-- Empty codex -->
    <div v-if="!persons.length" class="cx-empty">
      <div class="cx-empty-icon"><UiIcon name="book-open" :size="44" :stroke="1.5" /></div>
      <div class="cx-empty-title">{{ t('directory.codex.emptyTitle') }}</div>
      <div class="cx-empty-text">{{ t('directory.codex.emptyText') }}</div>
    </div>

    <template v-else>
      <!-- ── Index: the codex's table of entries (row-windowed) ── -->
      <aside class="cx-index" :class="{ 'cx-entering': entering }">
        <header class="cx-index-head">
          <div class="cx-index-title">
            <UiIcon class="cx-index-glyph" name="feather" :size="18" />
            {{ t('directory.codex.title') }}
          </div>
          <div class="cx-index-count">
            {{
              t(
                persons.length === 1
                  ? 'directory.codex.entries.one'
                  : 'directory.codex.entries.other',
                { n: persons.length }
              )
            }}
            <span class="cx-dot">·</span>
            {{ t('directory.codex.chronicledCount', { n: chronicled }) }}
          </div>
          <div class="cx-index-progress">
            <i :style="{ width: (chronicled / persons.length) * 100 + '%' }"></i>
          </div>
          <div class="cx-jump" @wheel.stop>
            <button
              v-for="l in letters"
              :key="l.ch"
              class="cx-jump-l"
              :class="{ on: l.ch === activeLetter }"
              :title="t('directory.codex.jumpTo', { ch: l.ch })"
              @click="turnTo(l.index)"
            >
              {{ l.ch }}
            </button>
            <form class="cx-jump-no" @submit.prevent="jumpToNo">
              <span>{{ t('directory.codex.jumpNo') }}</span>
              <input
                v-model="noInput"
                inputmode="numeric"
                :placeholder="String(active + 1).padStart(3, '0')"
                :aria-label="t('directory.codex.jumpToNumber')"
                @keydown.stop
              />
            </form>
          </div>
        </header>

        <div ref="listEl" class="cx-list" @scroll.passive="onListScroll">
          <div :key="enterKey" class="cx-list-sizer" :style="{ height: listHeight + 'px' }">
            <div
              class="cx-marker"
              :style="{ transform: `translateY(${INDEX_PAD + active * INDEX_ROW_H}px)` }"
              aria-hidden="true"
            ></div>
            <button
              v-for="r in rows"
              :key="r.p.id"
              class="cx-row"
              :class="{ on: r.i === active, dead: r.dead }"
              :style="r.style"
              @click="turnTo(r.i)"
            >
              <span class="cx-row-no">{{ r.no }}</span>
              <span class="cx-row-av" :style="{ '--rc': r.color }">
                <IndexArt :person="r.p" />
              </span>
              <span class="cx-row-name">{{ r.p.name || t('directory.codex.unnamed') }}</span>
              <span v-if="r.dead" class="cx-row-mark" :title="t('directory.codex.deceased')">
                <UiIcon name="moon" :size="12" :label="t('directory.codex.deceased')" />
              </span>
            </button>
          </div>
        </div>
      </aside>

      <!-- ── The entry page (and any leaves mid-turn) ── -->
      <section ref="stageEl" class="cx-stage" @wheel="onPageWheel">
        <div :key="enterKey" class="cx-book" :class="{ 'cx-entering': entering }">
          <div class="cx-edges" aria-hidden="true"></div>

          <div
            v-for="L in layers"
            :key="L.key"
            :ref="(el) => onLayerEl(el, L)"
            class="cx-page"
            :class="['cx-' + L.kind, L.dir ? 'cx-leaf-' + L.dir : '']"
            :style="{ zIndex: L.z }"
            :aria-hidden="L.kind === 'leaf' ? 'true' : null"
          >
            <div class="cx-page-body">
              <header class="cx-head">
                <span class="cx-no">{{ L.e.no }}</span>
                <span class="cx-head-rule"></span>
                <span class="cx-head-kind" :class="{ living: !L.e.dead }">
                  {{ L.e.dead ? t('directory.codex.deceased') : t('directory.codex.living') }}
                </span>
              </header>

              <div class="cx-hero">
                <div class="cx-portrait">
                  <button
                    class="cx-frame"
                    :style="{ '--sc': L.e.genderColor }"
                    :title="t('directory.codex.openProfile')"
                    :tabindex="L.kind === 'leaf' ? -1 : null"
                    @click="openProfile(L.e.p.id)"
                  >
                    <span class="cx-frame-inner" :class="{ dead: L.e.dead }">
                      <PortraitArt :person="L.e.p" />
                    </span>
                    <UiIcon class="cx-corner tl" name="sparkle" :size="12" />
                    <UiIcon class="cx-corner tr" name="sparkle" :size="12" />
                    <UiIcon class="cx-corner bl" name="sparkle" :size="12" />
                    <UiIcon class="cx-corner br" name="sparkle" :size="12" />
                  </button>

                  <!-- Wax seal: stamped anew each time the base page shows a new entry -->
                  <svg
                    :key="L.kind === 'base' ? 'seal-' + L.e.p.id : 'seal'"
                    class="cx-seal"
                    :class="{ 'cx-seal-stamp': L.kind === 'base' }"
                    viewBox="0 0 100 100"
                    :style="{ '--sc': L.e.sealColor, '--tilt': L.e.seal.tilt + 'deg' }"
                    aria-hidden="true"
                  >
                    <defs>
                      <radialGradient :id="uid + 'w' + L.key" cx="36%" cy="30%" r="78%">
                        <stop offset="0%" class="cx-wax-hi" />
                        <stop offset="52%" class="cx-wax-mid" />
                        <stop offset="100%" class="cx-wax-lo" />
                      </radialGradient>
                      <path :id="uid + 'a' + L.key" d="M 21 52 A 29 29 0 0 1 79 52" />
                    </defs>
                    <path :d="L.e.seal.d" :fill="`url(#${uid}w${L.key})`" class="cx-wax" />
                    <circle cx="50" cy="50" r="34" class="cx-seal-ring" />
                    <circle cx="50" cy="50" r="30.5" class="cx-seal-ring thin" />
                    <text class="cx-seal-arc">
                      <textPath
                        :href="'#' + uid + 'a' + L.key"
                        startOffset="50%"
                        text-anchor="middle"
                      >
                        {{ L.e.seal.arc }}
                      </textPath>
                    </text>
                    <text x="50" y="61" class="cx-seal-year" :class="{ long: L.e.seal.long }">
                      {{ L.e.seal.year }}
                    </text>
                    <path
                      class="cx-seal-star"
                      d="M50 67.5l1.3 3.2 3.2 1.3-3.2 1.3-1.3 3.2-1.3-3.2-3.2-1.3 3.2-1.3z"
                    />
                  </svg>
                </div>

                <div class="cx-hero-text">
                  <h2 class="cx-name">{{ L.e.name }}</h2>
                  <div v-if="L.e.epithet" class="cx-epithet">{{ L.e.epithet }}</div>
                  <div v-if="L.e.location" class="cx-loc">
                    <UiIcon class="cx-loc-glyph" name="map-pin" :size="14" />{{ L.e.location }}
                  </div>

                  <dl class="cx-vitals">
                    <div>
                      <dt>{{ t('directory.codex.born') }}</dt>
                      <dd :class="{ faint: !L.e.born }">
                        {{ L.e.born || t('directory.codex.unrecorded') }}
                      </dd>
                    </div>
                    <div>
                      <dt>{{ t('directory.codex.died') }}</dt>
                      <dd :class="{ faint: !L.e.died }">
                        {{ L.e.died || (L.e.dead ? t('directory.codex.unrecorded') : '—') }}
                      </dd>
                    </div>
                    <div>
                      <dt>{{ t('directory.codex.age') }}</dt>
                      <dd :class="{ faint: L.e.age == null }">{{ L.e.ageText }}</dd>
                    </div>
                  </dl>

                  <!-- Lifespan scale rule: this life against the longest in the roster -->
                  <div class="cx-span">
                    <div class="cx-span-label">
                      <span>{{ t('directory.codex.lifespan') }}</span>
                      <span class="cx-span-cap">{{ L.e.life.caption }}</span>
                    </div>
                    <div class="cx-rule" :style="{ '--minor': L.e.life.minorPct + '%' }">
                      <div
                        v-if="L.e.life.pct != null"
                        class="cx-rule-fill"
                        :class="{ living: L.e.life.living }"
                        :style="{ '--w': L.e.life.pct + '%', '--sc': L.e.genderColor }"
                      >
                        <i class="cx-rule-cap"></i>
                      </div>
                      <div v-else class="cx-rule-unknown">
                        {{ t('directory.codex.spanUnrecorded') }}
                      </div>
                      <span
                        v-for="tick in lifeScale.ticks"
                        :key="tick"
                        class="cx-tick"
                        :style="{ left: (tick / lifeScale.max) * 100 + '%' }"
                      >
                        <em>{{ tick }}</em>
                      </span>
                    </div>
                  </div>

                  <div v-if="L.e.tags.length" class="cx-sigils">
                    <span
                      v-for="tag in L.e.tags"
                      :key="tag.id"
                      class="cx-sigil"
                      :style="{ '--tc': tag.color || 'var(--accent)' }"
                    >
                      <b class="cx-sigil-mark">
                        <UiIcon v-if="tag.icon" :name="tag.icon" :size="12" :stroke="2.4" />
                        <template v-else>{{
                          (defaultNameLabel(tag.label) || '?').charAt(0)
                        }}</template>
                      </b>
                      {{ defaultNameLabel(tag.label) }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="cx-orn" aria-hidden="true"><UiIcon name="flower" :size="15" /></div>

              <div class="cx-lower">
                <section class="cx-kin">
                  <h3 class="cx-sec">{{ t('directory.codex.kinship') }}</h3>
                  <div class="cx-kin-body">
                    <svg class="cx-rosette" viewBox="-90 -90 180 180" aria-hidden="true">
                      <circle r="86" class="cx-ros-ring" />
                      <circle r="80" class="cx-ros-ring thin" />
                      <g
                        v-for="pt in L.e.petals"
                        :key="pt.key"
                        class="cx-petal-g"
                        :class="{ none: !pt.count }"
                        :style="{ '--pc': pt.tone, '--pa': pt.alpha }"
                      >
                        <path class="cx-petal" :d="PETAL_D" :transform="`rotate(${pt.angle})`" />
                        <path
                          class="cx-petal-vein"
                          d="M0 -30 L0 -60"
                          :transform="`rotate(${pt.angle})`"
                        />
                        <text class="cx-petal-n" :x="pt.nx" :y="pt.ny">{{ pt.count }}</text>
                        <UiIcon
                          class="cx-petal-g-l"
                          :name="pt.glyph"
                          :size="12"
                          :x="pt.gx - 6"
                          :y="pt.gy - 6"
                        />
                      </g>
                      <circle r="23" class="cx-ros-core" />
                      <circle r="19" class="cx-ros-ring thin" />
                      <text y="-1" class="cx-ros-n">{{ L.e.kinCount }}</text>
                      <text y="11" class="cx-ros-cap">{{ t('directory.codex.kinCap') }}</text>
                    </svg>

                    <div class="cx-kin-lists">
                      <div v-for="g in L.e.groups" :key="g.key" class="cx-kin-g">
                        <span class="cx-kin-k" :style="{ '--pc': g.tone }">
                          <i></i>{{ g.label }}
                        </span>
                        <span class="cx-kin-v">
                          <template v-for="(r, ri) in g.shown" :key="r.id">
                            <button
                              v-if="r.linked"
                              class="cx-rel"
                              :title="t('directory.codex.turnTo', { name: r.name })"
                              :tabindex="L.kind === 'leaf' ? -1 : null"
                              @click="turnToId(r.id)"
                            >
                              {{ r.name }}</button
                            ><span
                              v-else
                              class="cx-rel off"
                              :title="t('directory.codex.notInFilter')"
                              >{{ r.name }}</span
                            ><span v-if="ri < g.shown.length - 1" class="cx-comma">, </span>
                          </template>
                          <span v-if="g.more" class="cx-more">
                            {{ t('directory.codex.more', { n: g.more }) }}</span
                          >
                        </span>
                      </div>
                      <div v-if="!L.e.groups.length" class="cx-kin-none">
                        {{ t('directory.codex.noBonds') }}
                      </div>
                    </div>
                  </div>
                </section>

                <section class="cx-chron">
                  <h3 class="cx-sec">{{ t('directory.codex.chronicle') }}</h3>
                  <p v-if="L.e.bio" class="cx-bio">{{ L.e.bio }}</p>
                  <p v-else class="cx-bio-empty">
                    {{ t('directory.codex.noBio') }}
                  </p>
                </section>
              </div>

              <footer class="cx-foot">
                <button
                  class="cx-turn"
                  :disabled="L.e.i <= 0"
                  :tabindex="L.kind === 'leaf' ? -1 : null"
                  :title="t('directory.codex.prevTitle')"
                  :aria-label="t('directory.codex.prev')"
                  @click="turnBy(-1)"
                >
                  <UiIcon name="chevron-left" :size="16" />
                </button>
                <span class="cx-folio">{{
                  t('directory.codex.folio', { i: L.e.i + 1, n: persons.length })
                }}</span>
                <button
                  class="cx-turn"
                  :disabled="L.e.i >= persons.length - 1"
                  :tabindex="L.kind === 'leaf' ? -1 : null"
                  :title="t('directory.codex.nextTitle')"
                  :aria-label="t('directory.codex.next')"
                  @click="turnBy(1)"
                >
                  <UiIcon name="chevron-right" :size="16" />
                </button>
                <span class="cx-foot-sp"></span>
                <button
                  class="cx-open"
                  :tabindex="L.kind === 'leaf' ? -1 : null"
                  @click="openProfile(L.e.p.id)"
                >
                  {{ t('directory.codex.openProfile') }}
                  <UiIcon class="cx-open-arrow" name="arrow-right" :size="14" />
                </button>
              </footer>
            </div>
            <div class="cx-gutter" aria-hidden="true"></div>
            <div v-if="L.kind === 'leaf'" class="cx-leaf-shade" aria-hidden="true"></div>
          </div>

          <!-- Shadows cast by turning leaves onto the page beneath -->
          <div
            v-for="L in leaves"
            :key="'c' + L.id"
            :ref="(el) => onCastEl(el, L)"
            class="cx-cast"
            :style="{ zIndex: L.z - 1 }"
            aria-hidden="true"
          >
            <i></i>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick, h } from 'vue'
import { useMainStore } from '../../store/index.js'
import { ageOf, isDeceased } from './peopleLayout.js'
import UiIcon from '../ui/UiIcon.js'
import { useThumbnail } from './useThumbnail.js'
import { useI18n } from '../../i18n'
import { relTypeLabel, relRoleLabel, defaultNameLabel } from '../../lib/dataLabels'
import {
  INDEX_ROW_H,
  INDEX_PAD,
  entryNo,
  indexWindow,
  indexHeight,
  scrollToReveal,
  letterJumps,
  initialKey,
  initialsOf,
  lifespanScale,
  kinshipOf,
  sealPath,
  hashOf,
  turnKeyframes
} from './codexLayout.js'

// The Codex: an illustrated bestiary. A windowed index of numbered entries on
// the left; on the right, one composed entry page (ornate portrait, wax seal,
// vitals, a lifespan rule, a kinship rosette with clickable relatives, sigil
// tags and the chronicle). Changing entry turns the page in 3D around the
// spine — direction-aware, with the leaf casting a shadow that sweeps across
// the page beneath. Rapid turns stack up to a few leaves in flight; a change
// of direction settles them instantly, so the book can never tangle.

const props = defineProps({
  persons: { type: Array, required: true },
  statsOf: { type: Function, required: true },
  refYear: { type: Number, required: true }
})

const store = useMainStore()
const { t, locale } = useI18n()
const listEl = ref(null)
const stageEl = ref(null)
const uid = 'cx' + Math.random().toString(36).slice(2, 7)

const reduceMotion =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ── Art children (each visible item owns its reactive thumbnail) ──────────
const IndexArt = {
  props: { person: { type: Object, required: true } },
  setup(p) {
    const { src } = useThumbnail(() => p.person.primary_image || '', 64)
    return () =>
      src.value
        ? h('img', { class: 'cx-av-img', src: src.value, alt: '', draggable: false })
        : h('span', { class: 'cx-av-ini' }, initialsOf(p.person.name))
  }
}
const PortraitArt = {
  props: { person: { type: Object, required: true } },
  setup(p) {
    const { src, loading } = useThumbnail(() => p.person.primary_image || '', 384)
    return () =>
      src.value
        ? h('img', { class: 'cx-pt-img', src: src.value, alt: '', draggable: false })
        : h(
            'span',
            { class: ['cx-pt-mono', loading.value && 'loading'] },
            initialsOf(p.person.name)
          )
  }
}

// ── Lookups ───────────────────────────────────────────────────────────────
const count = computed(() => props.persons.length)
const clampIdx = (v) => Math.max(0, Math.min(Math.max(0, count.value - 1), v | 0))
const indexById = computed(() => {
  const m = new Map()
  props.persons.forEach((p, i) => m.set(p.id, i))
  return m
})
const personById = computed(() => new Map(store.persons.map((p) => [p.id, p])))
const genderColor = (p) =>
  p?.gender === 'male'
    ? store.graphSettings.maleColor
    : p?.gender === 'female'
      ? store.graphSettings.femaleColor
      : store.graphSettings.unknownColor

// ── Localized display text (the pure codexLayout helpers stay English) ────
// "No. 007" → the zero-padded number from entryNo(), framed per locale.
const entryLabel = (i, total) =>
  t('directory.codex.entryNo', { n: entryNo(i, total).replace(/^No\. /, '') })
// A DateValue honouring precision, like codexLayout's prettyDate().
function localDate(d) {
  if (!d || d.year == null || !Number.isFinite(Number(d.year))) return ''
  const y = Number(d.year)
  const year = y < 0 ? t('directory.codex.date.bce', { y: -y }) : String(y)
  const months = t('directory.codex.date.months')
  const m =
    d.precision !== 'year' && d.month >= 1 && d.month <= 12 && Array.isArray(months)
      ? months[d.month - 1]
      : ''
  if (!m) return t('directory.codex.date.year', { y: year })
  if (d.precision === 'day' && d.day) return t('directory.codex.date.day', { d: d.day, m, y: year })
  return t('directory.codex.date.month', { m, y: year })
}
// Built-in relationship type names / end roles → translated (renames verbatim).
const kinLabels = computed(() => {
  const m = new Map()
  const put = (raw, shown) => {
    if (raw && shown && shown !== raw && !m.has(raw)) m.set(raw, shown)
  }
  for (const def of store.relTypeByKey.values()) {
    put(def.role_a, relRoleLabel(def, 'a'))
    put(def.role_b, relRoleLabel(def, 'b'))
    put(def.label, relTypeLabel(def))
  }
  return m
})
const kinLabel = (label) =>
  kinLabels.value.get(label) || (label === 'Bond' ? t('directory.codex.bond') : label)

const chronicled = computed(() => props.persons.reduce((n, p) => n + (p.bio?.trim() ? 1 : 0), 0))
const lifeScale = computed(() => {
  let max = 0
  for (const p of props.persons) {
    const a = ageOf(p, props.refYear)
    if (a != null && a > max) max = a
  }
  return lifespanScale(max)
})

// ── Navigation state ──────────────────────────────────────────────────────
// `active` is the logical entry (index highlight, keyboard target); `baseIdx`
// is what the flat page under any turning leaves shows. They differ only while
// a backward turn is in flight (the old page stays down until the leaf lands).
const startIdx = () => {
  const i = indexById.value.get(store.selectedPersonId)
  return i == null ? 0 : i
}
const active = ref(startIdx())
const baseIdx = ref(active.value)
const leaves = ref([]) // { id, dir: 'fwd'|'back', idx, person, scroll, z }
const anims = new Map() // leaf id → Animation[]

const TURN_MS = 470
const MAX_LEAVES = 3
let leafSeq = 0
let burst = 0

function basePageBody() {
  return stageEl.value?.querySelector('.cx-base .cx-page-body') || null
}

function turnTo(i) {
  if (!count.value) return
  const to = clampIdx(i)
  const from = active.value
  if (to === from) return
  const dir = to > from ? 'fwd' : 'back'
  active.value = to
  if (reduceMotion || !stageEl.value) {
    settle()
    baseIdx.value = to
    return
  }
  // A change of direction mid-flight would tangle the stack: land everything.
  if (leaves.value.length && leaves.value[0].dir !== dir) settle()
  if (!leaves.value.length) burst = 0
  burst++
  const id = ++leafSeq
  if (dir === 'fwd') {
    // The flat page on top (the base) lifts off as a leaf; the target lies beneath.
    const bi = baseIdx.value
    leaves.value.push({
      id,
      dir,
      idx: bi,
      person: props.persons[bi],
      scroll: basePageBody()?.scrollTop || 0,
      z: Math.max(6, 900 - burst * 2) // older leaves ride above newer ones
    })
    baseIdx.value = to
  } else {
    // The earlier page swings in from the spine, landing over the current one.
    leaves.value.push({ id, dir, idx: to, person: props.persons[to], scroll: 0, z: 20 + burst * 2 })
  }
  while (leaves.value.length > MAX_LEAVES) {
    const old = leaves.value[0]
    if (old.dir === 'back') baseIdx.value = old.idx
    killAnims(old.id)
    leaves.value.splice(0, 1)
  }
}
function turnBy(delta) {
  turnTo(active.value + delta)
}
function turnToId(id) {
  const i = indexById.value.get(id)
  if (i != null) turnTo(i)
}

function killAnims(id) {
  const list = anims.get(id)
  if (list) list.forEach((a) => a.cancel())
  anims.delete(id)
}
// Land every leaf at once: the base shows the logical entry, nothing in flight.
function settle() {
  for (const L of leaves.value) killAnims(L.id)
  if (leaves.value.length) leaves.value = []
  baseIdx.value = active.value
}
function finishLeaf(id) {
  const k = leaves.value.findIndex((l) => l.id === id)
  if (k < 0) return
  const L = leaves.value[k]
  if (L.dir === 'back') baseIdx.value = L.idx
  leaves.value.splice(k, 1)
  anims.delete(id)
}

// Leaves and their cast shadows start their Web Animations when mounted.
// (Function refs re-run on every render; the `anims` guard keeps it one-shot.)
function onLayerEl(el, L) {
  if (!el || L.kind !== 'leaf') return
  const leaf = leaves.value.find((l) => l.id === L.id)
  if (!leaf || anims.has(L.id + ':leaf')) return
  const kf = turnKeyframes(leaf.dir)
  const opts = { duration: TURN_MS, easing: 'linear', fill: 'both' }
  const body = el.querySelector('.cx-page-body')
  if (body && leaf.scroll) body.scrollTop = leaf.scroll
  const a = el.animate(kf.leaf, opts)
  const shade = el.querySelector('.cx-leaf-shade')
  const b = shade ? shade.animate(kf.shade, opts) : null
  anims.set(L.id + ':leaf', true)
  const list = anims.get(L.id) || []
  list.push(a)
  if (b) list.push(b)
  anims.set(L.id, list)
  a.onfinish = () => {
    anims.delete(L.id + ':leaf')
    finishLeaf(L.id)
  }
  a.oncancel = () => anims.delete(L.id + ':leaf')
}
function onCastEl(el, L) {
  if (!el || anims.has(L.id + ':cast')) return
  const i = el.firstElementChild
  if (!i) return
  const kf = turnKeyframes(L.dir)
  const a = i.animate(kf.shadow, { duration: TURN_MS, easing: 'linear', fill: 'both' })
  anims.set(L.id + ':cast', true)
  const list = anims.get(L.id) || []
  list.push(a)
  anims.set(L.id, list)
  const done = () => anims.delete(L.id + ':cast')
  a.onfinish = done
  a.oncancel = done
}

// ── Entry view-models (memoized: the render re-runs on index scroll) ──────
const entryCache = computed(() => ({
  _deps: [
    store.relationships,
    store.relTypeRoles,
    store.relTypeByKey,
    store.tagsOf,
    personById.value,
    indexById.value,
    lifeScale.value,
    props.refYear,
    store.graphSettings.maleColor,
    store.graphSettings.femaleColor,
    store.graphSettings.unknownColor,
    kinLabels.value,
    locale.value
  ],
  map: new Map()
}))

const ROSETTE = [
  { key: 'parents', glyph: 'arrow-up', tone: 'var(--accent)' },
  { key: 'partners', glyph: 'heart-handshake', tone: 'var(--pink)' },
  { key: 'children', glyph: 'arrow-down', tone: 'var(--green)' },
  { key: 'siblings', glyph: 'users', tone: 'var(--amber)' },
  { key: 'others', glyph: 'sparkle', tone: 'var(--t2)' }
]
// A pointed vesica petal from the core (r 25) out to r 66, pointing up.
const PETAL_D = 'M0 -25 C 17 -35 17 -56 0 -66 C -17 -56 -17 -35 0 -25 Z'
const SHOW_MAX = 5

function entryOf(p, i) {
  const cache = entryCache.value.map
  const key = p.id + '|' + i
  let e = cache.get(key)
  if (!e) {
    e = buildEntry(p, i)
    cache.set(key, e)
  }
  return e
}

function buildEntry(p, i) {
  const ry = props.refYear
  const dead = isDeceased(p, ry)
  const age = ageOf(p, ry)
  const tags = store.tagsOf.get(p.id) || []
  const gColor = genderColor(p)
  const hash = hashOf(p.id)

  // Kinship
  const kin = kinshipOf(
    p.id,
    store.relationships,
    (t) => store.relTypeRoles.get(t),
    (t) => store.relTypeByKey.get(t)
  )
  const rel = (id) => ({
    id,
    name: personById.value.get(id)?.name || t('directory.codex.unnamed'),
    linked: indexById.value.has(id)
  })
  const groups = []
  const addGroup = (key, label, tone, ids) => {
    if (!ids.length) return
    const people = ids.map(rel)
    groups.push({
      key,
      label,
      tone,
      shown: people.slice(0, SHOW_MAX),
      more: Math.max(0, people.length - SHOW_MAX)
    })
  }
  addGroup('parents', t('directory.codex.groups.parents'), 'var(--accent)', kin.parents)
  addGroup('partners', t('directory.codex.groups.partners'), 'var(--pink)', kin.partners)
  addGroup('children', t('directory.codex.groups.children'), 'var(--green)', kin.children)
  addGroup('siblings', t('directory.codex.groups.siblings'), 'var(--amber)', kin.siblings)
  const byLabel = new Map()
  for (const o of kin.others) {
    if (!byLabel.has(o.label)) byLabel.set(o.label, { color: o.color, ids: [] })
    byLabel.get(o.label).ids.push(o.id)
  }
  for (const [label, g] of byLabel) {
    addGroup('o:' + label, kinLabel(label), g.color || 'var(--t2)', [...new Set(g.ids)])
  }
  const counts = {
    parents: kin.parents.length,
    partners: kin.partners.length,
    children: kin.children.length,
    siblings: kin.siblings.length,
    others: new Set(kin.others.map((o) => o.id)).size
  }
  const petals = ROSETTE.map((r, k) => {
    const angle = k * 72 // petals are drawn pointing up; rotate clockwise into place
    const c = counts[r.key]
    const rad = ((angle - 90) * Math.PI) / 180
    const at = (radius) => [
      +(Math.cos(rad) * radius).toFixed(2),
      +(Math.sin(rad) * radius).toFixed(2)
    ]
    const [nx, ny] = at(46)
    const [gx, gy] = at(73)
    return {
      key: r.key,
      tone: r.tone,
      glyph: r.glyph,
      count: c,
      alpha: c ? Math.min(1, 0.45 + c * 0.14).toFixed(2) : 0,
      angle,
      nx,
      ny,
      gx,
      gy
    }
  })
  const stats = props.statsOf(p.id) || { kin: 0, children: 0 }
  const kinCount = Math.max(
    stats.kin || 0,
    new Set([
      ...kin.parents,
      ...kin.partners,
      ...kin.children,
      ...kin.siblings,
      ...kin.others.map((o) => o.id)
    ]).size
  )

  // Vitals + lifespan
  const born = localDate(p.birth)
  const died = localDate(p.death)
  const scale = lifeScale.value
  const living = !dead && age != null
  const ageText =
    age == null
      ? t('directory.codex.ageUnknown')
      : dead
        ? t('directory.codex.ageYears', { n: age })
        : t('directory.codex.ageLiving', { n: age })
  let caption = t('directory.codex.captionUnrecorded')
  if (age != null) {
    const from = p.birth?.year
    const to = dead ? p.death?.year : ry
    caption = t('directory.codex.caption', {
      from: from ?? '?',
      to: dead ? (to ?? '?') : t('directory.codex.now'),
      age,
      max: scale.max
    })
  }

  // Seal
  const by = p.birth?.year
  const year = by == null ? '?' : by < 0 ? `${-by}` : String(by)
  return {
    p,
    i,
    no: entryLabel(i, count.value),
    name: p.name || t('directory.codex.unnamed'),
    epithet: (p.occupation || '').trim(),
    location: (p.location || '').trim(),
    dead,
    age,
    ageText,
    born,
    died,
    genderColor: gColor,
    sealColor: tags[0]?.color || gColor,
    tags,
    bio: (p.bio || '').trim(),
    groups,
    petals,
    kinCount,
    life: {
      pct: age == null ? null : Math.min(100, (age / scale.max) * 100),
      living,
      caption,
      minorPct: ((scale.step / 2 / scale.max) * 100).toFixed(4)
    },
    seal: {
      d: sealPath(50, 50, 46, 13, 0.075, hash % 97),
      tilt: (hash % 25) - 12,
      year,
      long: year.length > 4,
      arc:
        by == null
          ? t('directory.codex.seal.undated')
          : by < 0
            ? t('directory.codex.seal.discoveredBce')
            : t('directory.codex.seal.discovered')
    }
  }
}

// The stack of page layers to draw: the flat base plus any leaves in flight.
const layers = computed(() => {
  const n = count.value
  if (!n) return []
  const bi = Math.min(baseIdx.value, n - 1)
  const out = [{ key: 'base', kind: 'base', z: 1, e: entryOf(props.persons[bi], bi) }]
  for (const L of leaves.value) {
    if (!L.person) continue
    out.push({
      key: 'leaf' + L.id,
      id: L.id,
      kind: 'leaf',
      dir: L.dir,
      z: L.z,
      e: entryOf(L.person, L.idx)
    })
  }
  return out
})

// A fresh base page starts at the top of its body.
watch(baseIdx, () => {
  nextTick(() => {
    const b = basePageBody()
    if (b) b.scrollTop = 0
  })
})

// ── Index list (row-windowed) ─────────────────────────────────────────────
const listTop = ref(0)
const listH = ref(0)
const listHeight = computed(() => indexHeight(count.value))
let listRaf = 0
function onListScroll() {
  if (listRaf) return
  listRaf = requestAnimationFrame(() => {
    listRaf = 0
    listTop.value = listEl.value?.scrollTop || 0
  })
}
function measure() {
  const el = listEl.value
  if (!el) return
  listH.value = el.clientHeight
  listTop.value = el.scrollTop
}
const rows = computed(() => {
  const { start, end } = indexWindow(listTop.value, listH.value || 600, count.value)
  const out = []
  for (let i = start; i < end; i++) {
    const p = props.persons[i]
    out.push({
      p,
      i,
      no: entryLabel(i, count.value),
      dead: isDeceased(p, props.refYear),
      color: genderColor(p),
      style: {
        transform: `translateY(${INDEX_PAD + i * INDEX_ROW_H}px)`,
        '--d': Math.min(Math.max(0, i - start - 4), 18)
      }
    })
  }
  return out
})
function revealActive(smooth = true) {
  const el = listEl.value
  if (!el) return
  const top = scrollToReveal(el.scrollTop, el.clientHeight, active.value)
  if (top == null) return
  // Glide for nearby entries; a long jump (End, No. / A–Z) lands instantly.
  const near = Math.abs(top - el.scrollTop) < el.clientHeight * 2
  if (smooth && near && !reduceMotion) el.scrollTo({ top, behavior: 'smooth' })
  else el.scrollTop = top
}
watch(active, () => revealActive(true))

// A–Z + number quick jump
const letters = computed(() => letterJumps(props.persons))
const activeLetter = computed(() => initialKey(props.persons[active.value]?.name))
const noInput = ref('')
function jumpToNo() {
  const n = parseInt(String(noInput.value).replace(/\D/g, ''), 10)
  if (Number.isFinite(n) && n >= 1) turnTo(n - 1)
  noInput.value = ''
}

// ── Entrance (mount + whenever the roster's membership/order changes) ─────
const entering = ref(true)
const enterKey = ref(0)
let enterTimer = setTimeout(() => (entering.value = false), 1400)
let lastIds = props.persons.map((p) => p.id).join('|')
watch(
  () => props.persons,
  (list, old) => {
    const ids = list.map((p) => p.id).join('|')
    const curId = old?.[active.value]?.id
    let idx = curId != null ? indexById.value.get(curId) : undefined
    if (idx == null) idx = clampIdx(active.value)
    settle()
    active.value = idx
    baseIdx.value = idx
    if (ids === lastIds) return // same roster, fresh objects — no fanfare
    lastIds = ids
    enterKey.value++
    entering.value = true
    clearTimeout(enterTimer)
    enterTimer = setTimeout(() => (entering.value = false), 1400)
    nextTick(() => {
      measure()
      revealActive(false)
    })
  }
)

// ── Input: keyboard + wheel ───────────────────────────────────────────────
let lastKeyTurn = 0
function onKeydown(e) {
  if (!count.value) return
  if (store.modalOpen || store.formOpen || store.curtain?.active) return
  if (store.appSettingsOpen || store.userPageOpen || store.projectsPageOpen || store.browsePageOpen)
    return
  if (e.ctrlKey || e.metaKey || e.altKey) return
  const t = e.target
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
  if (t && t.isContentEditable) return
  const map = { ArrowUp: -1, ArrowLeft: -1, PageUp: -1, ArrowDown: 1, ArrowRight: 1, PageDown: 1 }
  if (map[e.key]) {
    e.preventDefault()
    const now = performance.now()
    if (e.repeat && now - lastKeyTurn < 150) return // held key: a brisk, legible flip
    lastKeyTurn = now
    turnBy(map[e.key])
  } else if (e.key === 'Home') {
    e.preventDefault()
    turnTo(0)
  } else if (e.key === 'End') {
    e.preventDefault()
    turnTo(count.value - 1)
  } else if (e.key === 'Enter' && props.persons[active.value]) {
    e.preventDefault()
    openProfile(props.persons[active.value].id)
  }
}

// Wheel over the page turns it (throttled) — unless the page body itself can
// still scroll that way, in which case the content scrolls first.
let wheelAcc = 0
let wheelIdle = 0
let lastWheelTurn = 0
function canScroll(el, dy) {
  if (!el || el.scrollHeight <= el.clientHeight + 1) return false
  return dy > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0
}
function onPageWheel(e) {
  if (e.ctrlKey) return
  const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX
  if (!d) return
  const body = e.target?.closest?.('.cx-base .cx-page-body')
  const now = performance.now()
  // Just turned: swallow the gesture's momentum tail so one flick = one page.
  const recent = now - lastWheelTurn < 360
  if (!recent && body && Math.abs(e.deltaY) >= Math.abs(e.deltaX) && canScroll(body, d)) return
  e.preventDefault()
  if (recent) return
  clearTimeout(wheelIdle)
  wheelIdle = setTimeout(() => (wheelAcc = 0), 220)
  if (Math.sign(d) !== Math.sign(wheelAcc)) wheelAcc = 0
  wheelAcc += d
  if (Math.abs(wheelAcc) < 40) return
  lastWheelTurn = now
  turnBy(Math.sign(wheelAcc))
  wheelAcc = 0
}

function openProfile(id) {
  if (id) store.selectPerson(id)
}

let ro = null
onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  nextTick(() => {
    measure()
    revealActive(false)
  })
  ro = new ResizeObserver(measure)
  if (listEl.value) ro.observe(listEl.value)
})
// The list mounts only once there are people; observe it when it appears.
watch(listEl, (el, old) => {
  if (old) ro?.unobserve(old)
  if (el) {
    ro?.observe(el)
    nextTick(measure)
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  ro?.disconnect()
  if (listRaf) cancelAnimationFrame(listRaf)
  clearTimeout(enterTimer)
  clearTimeout(wheelIdle)
  for (const list of anims.values()) if (Array.isArray(list)) list.forEach((a) => a.cancel())
  anims.clear()
})
</script>

<style scoped>
/* ── Palette: paper + ink + gilt, all derived from the theme tokens ── */
.codex {
  --paper: color-mix(in srgb, var(--surface) 88%, var(--amber));
  --paper-2: color-mix(in srgb, var(--surface) 78%, var(--amber));
  --paper-3: color-mix(in srgb, var(--surface) 66%, var(--amber));
  --ink: color-mix(in srgb, var(--t1) 86%, var(--amber));
  --ink-2: color-mix(in srgb, var(--t2) 80%, var(--amber));
  --ink-3: color-mix(in srgb, var(--t3) 70%, var(--amber));
  --rule: color-mix(in srgb, var(--amber) 42%, var(--t3));
  --gild: color-mix(in srgb, var(--amber) 70%, var(--t1));
  --gild-hi: color-mix(in srgb, var(--amber) 45%, var(--surface));
  --gild-lo: color-mix(in srgb, var(--amber) 55%, var(--t1));
  --serif: Georgia, 'Iowan Old Style', 'Palatino Linotype', 'Times New Roman', serif;

  position: relative;
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  overflow: hidden;
  background:
    radial-gradient(
      120% 90% at 70% 40%,
      color-mix(in srgb, var(--amber) 5%, transparent),
      transparent 70%
    ),
    var(--bg);
}
.codex.cx-dark {
  --paper: color-mix(in srgb, var(--elevated) 90%, var(--amber));
  --paper-2: color-mix(in srgb, var(--elevated) 84%, var(--amber));
  --paper-3: color-mix(in srgb, var(--surface) 80%, var(--amber));
  --ink: color-mix(in srgb, var(--t1) 90%, var(--amber));
  --ink-2: color-mix(in srgb, var(--t2) 86%, var(--amber));
  --ink-3: color-mix(in srgb, var(--t2) 55%, var(--surface));
  --rule: color-mix(in srgb, var(--amber) 38%, var(--t3));
  --gild: color-mix(in srgb, var(--amber) 78%, var(--t1));
  --gild-hi: color-mix(in srgb, var(--amber) 55%, var(--t1));
  --gild-lo: color-mix(in srgb, var(--amber) 55%, var(--bg));
}

/* ── Index panel ── */
.cx-index {
  position: relative;
  width: 284px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-right: 1px solid var(--border);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--surface) 92%, var(--amber)),
    color-mix(in srgb, var(--surface) 97%, var(--amber))
  );
  z-index: 2;
}
.cx-index-head {
  flex-shrink: 0;
  padding: 16px 16px 10px;
  border-bottom: 1px solid color-mix(in srgb, var(--rule) 40%, transparent);
}
.cx-index-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--serif);
  font-size: 21px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: var(--ink);
}
.cx-index-glyph {
  color: var(--gild);
}
.cx-index-count {
  margin-top: 2px;
  font-size: 12px;
  font-weight: 600;
  color: var(--t2);
  font-variant-numeric: tabular-nums;
}
.cx-dot {
  color: var(--t3);
  margin: 0 3px;
}
.cx-index-progress {
  margin-top: 8px;
  height: 3px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--rule) 25%, transparent);
  overflow: hidden;
}
.cx-index-progress i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--gild-lo), var(--gild));
  transition: width 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}
.cx-jump {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  max-height: 66px;
  overflow-y: auto;
  scrollbar-width: none;
}
.cx-jump::-webkit-scrollbar {
  display: none;
}
.cx-jump-l {
  min-width: 19px;
  height: 19px;
  padding: 0 3px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--t3);
  font-family: var(--serif);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition:
    color 0.15s,
    background 0.15s,
    transform 0.2s;
}
.cx-jump-l:hover {
  color: var(--t1);
  transform: translateY(-1px) scale(1.15);
}
.cx-jump-l.on {
  background: var(--adim);
  color: var(--accent);
}
.cx-jump-no {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: var(--serif);
  font-size: 12px;
  font-weight: 700;
  color: var(--t3);
}
.cx-jump-no input {
  width: 46px;
  height: 20px;
  padding: 0 6px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  color: var(--t1);
  font-family: var(--serif);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  outline: none;
}
.cx-jump-no input:focus {
  border-color: var(--accent);
}

.cx-list {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}
.cx-list-sizer {
  position: relative;
  width: 100%;
}
/* The sliding bookmark marking the open entry */
.cx-marker {
  position: absolute;
  top: 0;
  left: 8px;
  right: 8px;
  height: 46px;
  border-radius: 10px;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--accent) 20%, transparent),
    color-mix(in srgb, var(--accent) 7%, transparent)
  );
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 32%, transparent);
  transition: transform 0.38s cubic-bezier(0.22, 1, 0.36, 1);
  pointer-events: none;
}
.cx-marker::before {
  content: '';
  position: absolute;
  left: -8px;
  top: 9px;
  bottom: 9px;
  width: 4px;
  border-radius: 0 4px 4px 0;
  background: var(--accent);
  box-shadow: 0 0 10px color-mix(in srgb, var(--accent) 70%, transparent);
}
.cx-row {
  position: absolute;
  top: 0;
  left: 8px;
  right: 8px;
  height: 46px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 10px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--t2);
  font-family: var(--font);
  text-align: left;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
}
.cx-row:hover {
  background: color-mix(in srgb, var(--hover) 70%, transparent);
  color: var(--t1);
}
.cx-row.on {
  color: var(--t1);
}
.cx-entering .cx-row {
  animation: cx-row-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) calc(var(--d, 0) * 0.03s) backwards;
}
@keyframes cx-row-in {
  from {
    opacity: 0;
    translate: -18px 0;
  }
}
.cx-row-no {
  width: 50px;
  flex-shrink: 0;
  font-family: var(--serif);
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.3px;
  color: var(--t3);
  font-variant-numeric: tabular-nums;
}
.cx-row.on .cx-row-no {
  color: var(--accent);
}
.cx-row-av {
  --rc: var(--accent);
  position: relative;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid color-mix(in srgb, var(--rc) 60%, transparent);
  background: color-mix(in srgb, var(--rc) 18%, var(--elevated));
}
.cx-row.dead .cx-row-av {
  filter: grayscale(0.55);
}
.cx-row :deep(.cx-av-img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cx-row :deep(.cx-av-ini) {
  font-size: 11.5px;
  font-weight: 800;
  color: var(--t1);
}
.cx-row-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cx-row-mark {
  display: inline-flex;
  color: var(--t3);
}

/* ── Stage + book ── */
.cx-stage {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  align-items: stretch;
  justify-content: center;
  padding: 22px 34px 22px 26px;
  overflow: hidden;
}
.cx-book {
  position: relative;
  width: min(100%, 900px);
  perspective: 3000px;
  perspective-origin: 0% 50%;
  isolation: isolate;
}
.cx-book.cx-entering {
  animation: cx-book-in 0.75s cubic-bezier(0.22, 1, 0.36, 1) backwards;
}
@keyframes cx-book-in {
  from {
    opacity: 0;
    transform: translateY(18px) scale(0.975);
  }
}
/* The thickness of the pages still to come, peeking past the right edge */
.cx-edges {
  position: absolute;
  inset: 6px -9px 6px 20px;
  border-radius: 4px 12px 12px 4px;
  background: var(--paper-3);
  box-shadow:
    -3px 0 0 -1px var(--paper-2),
    3px 3px 0 -1px var(--paper-2),
    6px 6px 0 -2px var(--paper-3),
    0 22px 50px -18px rgba(0, 0, 0, 0.55);
  background-image: repeating-linear-gradient(
    90deg,
    transparent 0 2px,
    color-mix(in srgb, var(--rule) 30%, transparent) 2px 3px
  );
  z-index: 0;
}

.cx-page {
  position: absolute;
  inset: 0;
  border-radius: 3px 10px 10px 3px;
  background:
    radial-gradient(
      140% 100% at 30% 20%,
      transparent 55%,
      color-mix(in srgb, var(--amber) 9%, transparent) 100%
    ),
    radial-gradient(
      circle at 88% 12%,
      color-mix(in srgb, var(--amber) 7%, transparent),
      transparent 18%
    ),
    radial-gradient(
      circle at 12% 90%,
      color-mix(in srgb, var(--amber) 6%, transparent),
      transparent 22%
    ),
    var(--paper);
  box-shadow:
    0 1px 0 color-mix(in srgb, var(--gild) 18%, transparent) inset,
    0 18px 40px -20px rgba(0, 0, 0, 0.5);
  transform-origin: 0 50%;
  backface-visibility: hidden;
  overflow: hidden;
  color: var(--ink);
  container-type: inline-size;
}
.cx-leaf {
  pointer-events: none;
  will-change: transform;
}
.cx-book.cx-entering .cx-base {
  animation: cx-page-open 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.05s backwards;
}
@keyframes cx-page-open {
  from {
    transform: rotateY(-38deg);
    opacity: 0.2;
  }
}
/* Faint fibre grain over the paper */
.cx-page::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.35;
  background-image:
    repeating-linear-gradient(
      0deg,
      color-mix(in srgb, var(--rule) 8%, transparent) 0 1px,
      transparent 1px 4px
    ),
    repeating-linear-gradient(
      90deg,
      color-mix(in srgb, var(--rule) 5%, transparent) 0 1px,
      transparent 1px 7px
    );
  z-index: 0;
}
/* Binding gutter along the spine */
.cx-gutter {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 46px;
  pointer-events: none;
  background: linear-gradient(
    90deg,
    rgba(0, 0, 0, 0.26),
    rgba(0, 0, 0, 0.08) 38%,
    transparent 100%
  );
  z-index: 3;
}
.cx-light .cx-gutter {
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--amber) 30%, rgba(0, 0, 0, 0.12)),
    color-mix(in srgb, var(--amber) 8%, transparent) 40%,
    transparent 100%
  );
}
/* Darkening across a leaf as it turns away from the light */
.cx-leaf-shade {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  background: linear-gradient(90deg, rgba(0, 0, 0, 0.25), rgba(0, 0, 0, 0.7));
  z-index: 4;
}
/* Shadow a leaf casts onto the page beneath, riding its free edge */
.cx-cast {
  position: absolute;
  inset: 0;
  border-radius: 3px 10px 10px 3px;
  overflow: hidden;
  pointer-events: none;
}
.cx-cast i {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 100%;
  opacity: 0;
  background: linear-gradient(
    90deg,
    rgba(0, 0, 0, 0.5) 0%,
    rgba(0, 0, 0, 0.22) 9%,
    rgba(0, 0, 0, 0.06) 26%,
    transparent 42%
  );
  will-change: transform, opacity;
}

.cx-page-body {
  position: absolute;
  inset: 0;
  z-index: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 26px 40px 20px 62px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--rule) 50%, transparent) transparent;
}

/* Header rule */
.cx-head {
  display: flex;
  align-items: center;
  gap: 14px;
  font-family: var(--serif);
}
.cx-no {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: var(--gild);
  font-variant-numeric: tabular-nums;
}
.cx-head-rule {
  flex: 1;
  height: 5px;
  border-top: 1px solid color-mix(in srgb, var(--rule) 70%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--rule) 35%, transparent);
}
.cx-head-kind {
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 2.4px;
  text-transform: uppercase;
  color: var(--ink-3);
}
.cx-head-kind.living {
  color: color-mix(in srgb, var(--green) 75%, var(--ink));
}

/* Hero: portrait + identity */
.cx-hero {
  display: grid;
  grid-template-columns: 208px 1fr;
  gap: 34px;
  align-items: start;
}
.cx-portrait {
  position: relative;
  width: 208px;
  padding-bottom: 14px;
}
.cx-frame {
  --sc: var(--accent);
  position: relative;
  display: block;
  width: 196px;
  height: 244px;
  padding: 8px;
  border: none;
  border-radius: 98px 98px 10px 10px;
  background: linear-gradient(
    150deg,
    var(--gild-hi) 0%,
    var(--gild) 28%,
    var(--gild-lo) 52%,
    var(--gild) 74%,
    var(--gild-hi) 100%
  );
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--gild-lo) 60%, transparent),
    0 0 0 5px var(--paper),
    0 0 0 6px color-mix(in srgb, var(--rule) 55%, transparent),
    0 18px 30px -14px rgba(0, 0, 0, 0.55);
  cursor: pointer;
  transition:
    transform 0.3s cubic-bezier(0.34, 1.4, 0.5, 1),
    box-shadow 0.3s;
}
.cx-frame:hover {
  transform: translateY(-2px) rotate(-0.6deg);
}
.cx-frame-inner {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 90px 90px 5px 5px;
  overflow: hidden;
  background: radial-gradient(
    90% 70% at 50% 30%,
    color-mix(in srgb, var(--sc) 26%, var(--paper-2)),
    var(--paper-3)
  );
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--gild-lo) 70%, transparent);
}
.cx-frame-inner::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--gild-hi) 50%, transparent),
    inset 0 0 26px rgba(0, 0, 0, 0.35);
  pointer-events: none;
}
.cx-frame-inner.dead :deep(.cx-pt-img) {
  filter: grayscale(0.45) sepia(0.25);
}
.cx-frame :deep(.cx-pt-img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}
.cx-frame:hover :deep(.cx-pt-img) {
  transform: scale(1.05);
}
.cx-frame :deep(.cx-pt-mono) {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--serif);
  font-size: 64px;
  font-weight: 700;
  font-style: italic;
  color: color-mix(in srgb, var(--sc) 55%, var(--ink));
  text-shadow: 0 2px 0 color-mix(in srgb, var(--paper) 70%, transparent);
}
.cx-frame :deep(.cx-pt-mono.loading) {
  opacity: 0.35;
}
.cx-corner {
  position: absolute;
  color: var(--gild);
  filter: drop-shadow(0 1px 0 color-mix(in srgb, var(--paper) 80%, transparent));
  pointer-events: none;
}
.cx-corner.tl {
  top: 38px;
  left: -16px;
}
.cx-corner.tr {
  top: 38px;
  right: -16px;
}
.cx-corner.bl {
  bottom: -16px;
  left: -16px;
}
.cx-corner.br {
  bottom: -16px;
  right: -16px;
}

/* Wax seal */
.cx-seal {
  --sc: var(--accent);
  position: absolute;
  right: -6px;
  bottom: -8px;
  width: 92px;
  height: 92px;
  transform: rotate(var(--tilt, -8deg));
  filter: drop-shadow(0 5px 6px rgba(0, 0, 0, 0.4));
  overflow: visible;
}
.cx-seal-stamp {
  animation: cx-stamp 0.55s cubic-bezier(0.3, 1.6, 0.55, 1) 0.26s backwards;
}
@keyframes cx-stamp {
  0% {
    opacity: 0;
    transform: rotate(calc(var(--tilt, -8deg) - 22deg)) scale(1.9);
  }
  55% {
    opacity: 1;
    transform: rotate(var(--tilt, -8deg)) scale(0.92);
  }
}
.cx-wax-hi {
  stop-color: color-mix(in srgb, var(--sc) 62%, white);
}
.cx-wax-mid {
  stop-color: var(--sc);
}
.cx-wax-lo {
  stop-color: color-mix(in srgb, var(--sc) 55%, black);
}
.cx-seal-ring {
  fill: none;
  stroke: color-mix(in srgb, var(--sc) 50%, black);
  stroke-width: 1.6;
  opacity: 0.55;
}
.cx-seal-ring.thin {
  stroke-width: 0.7;
  stroke-dasharray: 1.4 2;
}
.cx-seal-arc {
  font-family: var(--serif);
  font-size: 9.4px;
  font-weight: 700;
  letter-spacing: 1.4px;
  fill: color-mix(in srgb, var(--sc) 35%, black);
  opacity: 0.8;
}
.cx-seal-year {
  font-family: var(--serif);
  font-size: 19px;
  font-weight: 700;
  text-anchor: middle;
  fill: color-mix(in srgb, var(--sc) 38%, black);
  paint-order: stroke;
  stroke: color-mix(in srgb, var(--sc) 60%, white);
  stroke-width: 0.6px;
  stroke-opacity: 0.45;
  font-variant-numeric: tabular-nums;
}
.cx-seal-year.long {
  font-size: 14px;
}
.cx-seal-star {
  fill: color-mix(in srgb, var(--sc) 38%, black);
  opacity: 0.75;
}

.cx-hero-text {
  min-width: 0;
  padding-top: 6px;
}
.cx-name {
  font-family: var(--serif);
  font-size: 38px;
  line-height: 1.08;
  font-weight: 700;
  letter-spacing: -0.4px;
  color: var(--ink);
  overflow-wrap: anywhere;
}
.cx-epithet {
  margin-top: 6px;
  font-family: var(--serif);
  font-style: italic;
  font-size: 17px;
  color: var(--ink-2);
}
.cx-epithet::before {
  content: '— ';
  color: var(--gild);
}
.cx-loc {
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-2);
}
.cx-loc-glyph {
  color: var(--gild);
}

.cx-vitals {
  margin-top: 18px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-top: 1px solid color-mix(in srgb, var(--rule) 55%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--rule) 55%, transparent);
}
.cx-vitals > div {
  padding: 9px 12px 8px;
  min-width: 0;
}
.cx-vitals > div + div {
  border-left: 1px dotted color-mix(in srgb, var(--rule) 60%, transparent);
}
.cx-vitals dt {
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--ink-3);
}
.cx-vitals dd {
  margin-top: 1px;
  font-family: var(--serif);
  font-size: 16px;
  font-weight: 700;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-variant-numeric: tabular-nums;
}
.cx-vitals dd.faint {
  color: var(--ink-3);
  font-style: italic;
  font-weight: 400;
}

/* Lifespan scale rule */
.cx-span {
  margin-top: 16px;
}
.cx-span-label {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--ink-3);
}
.cx-span-cap {
  font-family: var(--serif);
  font-size: 12px;
  letter-spacing: 0.3px;
  text-transform: none;
  font-weight: 700;
  color: var(--ink-2);
  font-variant-numeric: tabular-nums;
}
.cx-rule {
  position: relative;
  margin-top: 6px;
  margin-bottom: 18px;
  height: 14px;
  border: 1px solid color-mix(in srgb, var(--rule) 75%, transparent);
  border-radius: 2px;
  background:
    repeating-linear-gradient(
        90deg,
        color-mix(in srgb, var(--rule) 55%, transparent) 0 1px,
        transparent 1px var(--minor, 5%)
      )
      bottom / 100% 5px no-repeat,
    color-mix(in srgb, var(--paper-2) 80%, transparent);
}
.cx-rule-fill {
  --sc: var(--accent);
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 2px;
  width: calc(var(--w, 0%) - 4px);
  min-width: 4px;
  border-radius: 1px;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--sc) 35%, var(--gild)),
    color-mix(in srgb, var(--sc) 70%, var(--gild))
  );
  box-shadow: 0 0 10px -2px color-mix(in srgb, var(--sc) 60%, transparent);
  transform-origin: 0 50%;
}
.cx-base .cx-rule-fill {
  animation: cx-fill 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.2s backwards;
}
@keyframes cx-fill {
  from {
    transform: scaleX(0);
  }
}
.cx-rule-cap {
  position: absolute;
  right: -3px;
  top: -5px;
  bottom: -5px;
  width: 3px;
  border-radius: 2px;
  background: var(--ink);
}
.cx-rule-fill.living .cx-rule-cap {
  background: var(--green);
  box-shadow: 0 0 8px var(--green);
  animation: cx-alive 1.8s ease-in-out infinite;
}
@keyframes cx-alive {
  50% {
    opacity: 0.35;
  }
}
.cx-rule-unknown {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--serif);
  font-style: italic;
  font-size: 11px;
  color: var(--ink-3);
}
.cx-tick {
  position: absolute;
  top: 100%;
  width: 0;
  height: 6px;
  border-left: 1px solid color-mix(in srgb, var(--rule) 90%, transparent);
}
.cx-tick em {
  position: absolute;
  top: 5px;
  left: 0;
  transform: translateX(-50%);
  font-family: var(--serif);
  font-style: normal;
  font-size: 10.5px;
  font-weight: 700;
  color: var(--ink-3);
  font-variant-numeric: tabular-nums;
}

/* Tag sigils */
.cx-sigils {
  margin-top: 4px;
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}
.cx-sigil {
  --tc: var(--accent);
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 3px 11px 3px 3px;
  border-radius: 20px;
  border: 1px solid color-mix(in srgb, var(--tc) 50%, transparent);
  background: color-mix(in srgb, var(--tc) 11%, transparent);
  font-family: var(--serif);
  font-size: 12.5px;
  font-weight: 700;
  color: var(--ink);
  max-width: 220px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cx-sigil-mark {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 800;
  color: color-mix(in srgb, var(--tc) 30%, black);
  background: radial-gradient(
    circle at 35% 30%,
    color-mix(in srgb, var(--tc) 55%, white),
    var(--tc) 60%,
    color-mix(in srgb, var(--tc) 60%, black)
  );
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* Ornamental divider */
.cx-orn {
  display: flex;
  align-items: center;
  gap: 14px;
  color: var(--gild);
  font-size: 15px;
}
.cx-orn::before,
.cx-orn::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--rule) 70%, transparent));
}
.cx-orn::after {
  background: linear-gradient(90deg, color-mix(in srgb, var(--rule) 70%, transparent), transparent);
}

/* Lower half: kinship + chronicle */
.cx-lower {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  gap: 30px;
  align-items: start;
}
.cx-sec {
  margin-bottom: 10px;
  font-family: var(--serif);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: var(--gild);
}
.cx-kin-body {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}
.cx-rosette {
  width: 158px;
  height: 158px;
  flex-shrink: 0;
  overflow: visible;
}
.cx-ros-ring {
  fill: none;
  stroke: color-mix(in srgb, var(--rule) 55%, transparent);
  stroke-width: 0.9;
}
.cx-ros-ring.thin {
  stroke-dasharray: 1.5 2.5;
}
.cx-petal {
  fill: color-mix(in srgb, var(--pc) 45%, transparent);
  fill-opacity: var(--pa, 0.6);
  stroke: color-mix(in srgb, var(--pc) 80%, transparent);
  stroke-width: 1.2;
}
.cx-petal-vein {
  fill: none;
  stroke: color-mix(in srgb, var(--pc) 55%, transparent);
  stroke-width: 0.8;
  stroke-dasharray: 2 2.5;
  opacity: 0.55;
}
.cx-petal-g.none .cx-petal {
  fill: none;
  stroke: color-mix(in srgb, var(--rule) 50%, transparent);
  stroke-dasharray: 2.5 2.5;
}
.cx-petal-g.none .cx-petal-vein {
  display: none;
}
.cx-base .cx-petal-g {
  animation: cx-petal 0.55s cubic-bezier(0.22, 1, 0.36, 1) backwards;
}
.cx-base .cx-petal-g:nth-of-type(1) {
  animation-delay: 0.25s;
}
.cx-base .cx-petal-g:nth-of-type(2) {
  animation-delay: 0.31s;
}
.cx-base .cx-petal-g:nth-of-type(3) {
  animation-delay: 0.37s;
}
.cx-base .cx-petal-g:nth-of-type(4) {
  animation-delay: 0.43s;
}
.cx-base .cx-petal-g:nth-of-type(5) {
  animation-delay: 0.49s;
}
@keyframes cx-petal {
  from {
    opacity: 0;
  }
}
.cx-petal-n {
  font-family: var(--serif);
  font-size: 15px;
  font-weight: 700;
  text-anchor: middle;
  dominant-baseline: central;
  fill: var(--ink);
}
.cx-petal-g.none .cx-petal-n {
  fill: var(--ink-3);
  font-weight: 400;
}
.cx-petal-g-l {
  overflow: visible;
  color: color-mix(in srgb, var(--pc) 80%, var(--ink));
}
.cx-petal-g.none .cx-petal-g-l {
  color: var(--ink-3);
}
.cx-ros-core {
  fill: var(--paper-2);
  stroke: var(--gild);
  stroke-width: 1.4;
}
.cx-ros-n {
  font-family: var(--serif);
  font-size: 19px;
  font-weight: 700;
  text-anchor: middle;
  fill: var(--ink);
}
.cx-ros-cap {
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 1.6px;
  text-anchor: middle;
  fill: var(--ink-3);
}
.cx-kin-lists {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 2px;
}
.cx-kin-g {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.cx-kin-k {
  --pc: var(--accent);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 1.6px;
  text-transform: uppercase;
  color: var(--ink-3);
}
.cx-kin-k i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--pc);
  box-shadow: 0 0 6px color-mix(in srgb, var(--pc) 60%, transparent);
}
.cx-kin-v {
  font-family: var(--serif);
  font-size: 13.5px;
  line-height: 1.4;
  color: var(--ink);
}
.cx-rel {
  display: inline;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  color: inherit;
  cursor: pointer;
  text-decoration: underline;
  text-decoration-style: dotted;
  text-decoration-color: color-mix(in srgb, var(--gild) 70%, transparent);
  text-underline-offset: 3px;
  transition: color 0.15s;
}
.cx-rel:hover {
  color: var(--accent);
  text-decoration-style: solid;
  text-decoration-color: var(--accent);
}
.cx-rel.off {
  cursor: default;
  text-decoration: none;
  color: var(--ink-2);
}
.cx-comma {
  color: var(--ink-3);
}
.cx-more {
  font-style: italic;
  font-size: 12.5px;
  color: var(--ink-3);
}
.cx-kin-none {
  font-family: var(--serif);
  font-style: italic;
  font-size: 13px;
  color: var(--ink-3);
  padding-top: 8px;
}

.cx-bio {
  font-family: var(--serif);
  font-size: 14.5px;
  line-height: 1.62;
  color: var(--ink);
  white-space: pre-line;
  overflow-wrap: anywhere;
}
.cx-bio::first-letter {
  float: left;
  margin: 5px 9px 0 0;
  padding: 2px 7px 0;
  font-size: 46px;
  line-height: 0.9;
  font-weight: 700;
  color: var(--gild);
  border: 1px solid color-mix(in srgb, var(--rule) 60%, transparent);
  border-radius: 3px;
  background: color-mix(in srgb, var(--gild) 9%, transparent);
  text-shadow: 0 1px 0 color-mix(in srgb, var(--paper) 90%, transparent);
}
.cx-bio-empty {
  font-family: var(--serif);
  font-style: italic;
  font-size: 14px;
  line-height: 1.6;
  color: var(--ink-3);
  padding: 12px 14px;
  border: 1px dashed color-mix(in srgb, var(--rule) 55%, transparent);
  border-radius: 6px;
}

/* Footer */
.cx-foot {
  margin-top: auto;
  padding-top: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-top: 1px solid color-mix(in srgb, var(--rule) 40%, transparent);
}
.cx-folio {
  font-family: var(--serif);
  font-style: italic;
  font-size: 12.5px;
  color: var(--ink-3);
  font-variant-numeric: tabular-nums;
}
.cx-foot-sp {
  flex: 1;
}
.cx-turn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--rule) 70%, transparent);
  background: transparent;
  color: var(--ink-2);
  font-family: var(--serif);
  font-size: 17px;
  line-height: 1;
  cursor: pointer;
  transition:
    color 0.15s,
    border-color 0.15s,
    transform 0.2s,
    background 0.15s;
}
.cx-turn:hover:not(:disabled) {
  color: var(--ink);
  border-color: var(--gild);
  background: color-mix(in srgb, var(--gild) 10%, transparent);
  transform: scale(1.08);
}
.cx-turn:disabled {
  opacity: 0.35;
  cursor: default;
}
.cx-open {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  color: var(--ink);
  font-family: var(--serif);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.3px;
  cursor: pointer;
  transition:
    background 0.15s,
    transform 0.2s,
    box-shadow 0.2s;
}
.cx-open-arrow {
  transition: transform 0.2s;
}
.cx-open:hover {
  background: color-mix(in srgb, var(--accent) 24%, transparent);
  box-shadow: 0 6px 18px -8px color-mix(in srgb, var(--accent) 70%, transparent);
}
.cx-open:hover .cx-open-arrow {
  transform: translateX(3px);
}

/* Narrow pages: stack the hero and the lower halves */
/* Medium pages: a slimmer portrait, lower halves stacked */
@container (max-width: 780px) {
  .cx-page-body {
    padding: 22px 28px 18px 44px;
    gap: 14px;
  }
  .cx-hero {
    grid-template-columns: 150px 1fr;
    gap: 24px;
  }
  .cx-portrait {
    width: 150px;
  }
  .cx-frame {
    width: 146px;
    height: 184px;
    padding: 6px;
    border-radius: 73px 73px 8px 8px;
  }
  .cx-frame-inner {
    border-radius: 67px 67px 4px 4px;
  }
  .cx-frame :deep(.cx-pt-mono) {
    font-size: 48px;
  }
  .cx-corner.tl,
  .cx-corner.tr {
    top: 26px;
  }
  .cx-seal {
    width: 70px;
    height: 70px;
    right: -8px;
  }
  .cx-name {
    font-size: 30px;
  }
  .cx-epithet {
    font-size: 15px;
  }
  .cx-vitals dd {
    font-size: 14.5px;
  }
  .cx-lower {
    grid-template-columns: 1fr;
    gap: 18px;
  }
}

/* Narrow pages: everything in one centred column */
@container (max-width: 520px) {
  .cx-hero {
    grid-template-columns: 1fr;
    justify-items: center;
    gap: 18px;
  }
  .cx-hero-text {
    width: 100%;
    text-align: center;
  }
  .cx-loc {
    justify-content: center;
  }
  .cx-sigils {
    justify-content: center;
  }
  .cx-lower {
    grid-template-columns: 1fr;
    gap: 18px;
  }
  .cx-page-body {
    padding: 18px 18px 14px 32px;
  }
  .cx-name {
    font-size: 26px;
  }
  .cx-kin-body {
    flex-direction: column;
    align-items: center;
  }
}

/* ── Empty state ── */
.cx-empty {
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
.cx-empty-icon {
  display: flex;
  color: var(--amber);
}
.cx-empty-title {
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 18px;
  font-weight: 700;
  color: var(--t1);
}
.cx-empty-text {
  font-size: 13px;
  max-width: 280px;
  text-align: center;
}

@media (max-width: 760px) {
  .cx-index {
    width: 200px;
  }
  .cx-row-no {
    display: none;
  }
  .cx-stage {
    padding: 14px 18px 14px 12px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cx-entering .cx-row,
  .cx-book.cx-entering,
  .cx-book.cx-entering .cx-base,
  .cx-seal-stamp,
  .cx-base .cx-rule-fill,
  .cx-base .cx-petal-g,
  .cx-rule-fill.living .cx-rule-cap {
    animation: none;
  }
  .cx-marker {
    transition: none;
  }
}
</style>
