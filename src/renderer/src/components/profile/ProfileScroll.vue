<template>
  <div
    ref="rootEl"
    class="ps"
    :class="[
      'ps-th-' + store.theme,
      { 'ps-vert': vertical, 'ps-rm': reduceMotion, 'ps-turning': turning }
    ]"
    :style="rootVars"
  >
    <div class="ps-table" aria-hidden="true"></div>

    <div class="ps-scroll">
      <div class="ps-roller ps-roller-a" aria-hidden="true">
        <i class="ps-knob ps-knob-1"></i><i class="ps-rod"></i><i class="ps-knob ps-knob-2"></i>
      </div>

      <div ref="paperEl" class="ps-paper">
        <!-- The painting: one landscape per person, parallaxed behind the leaves -->
        <div class="ps-land-wrap" aria-hidden="true">
          <Transition name="ps-land">
            <canvas :key="seed" :ref="landRef" class="ps-land" :data-seed="seed"></canvas>
          </Transition>
        </div>
        <div class="ps-mist ps-mist-a" aria-hidden="true"></div>
        <div class="ps-mist ps-mist-b" aria-hidden="true"></div>
        <div class="ps-silk ps-silk-1" aria-hidden="true"></div>
        <div class="ps-silk ps-silk-2" aria-hidden="true"></div>

        <Transition :name="profile.navDir < 0 ? 'ps-nav-b' : 'ps-nav-f'">
          <div
            :key="person.id"
            :ref="trackRef"
            class="ps-track"
            :class="{ 'ps-quick': quick }"
            tabindex="-1"
            @scroll.passive="onScroll"
          >
            <div class="ps-leaves">
              <!-- ── 引首 · the frontispiece: portrait, name, seal, inscription ── -->
              <section class="ps-leaf ps-hero" :class="seenCls('hero')" data-leaf="hero">
                <button
                  class="ps-portrait"
                  :class="{ 'ps-portrait-photo': !!profile.portraitUrl }"
                  :title="profile.portraitIndex >= 0 ? 'View portrait' : ''"
                  @click="openPortrait"
                >
                  <span class="ps-enso" :style="{ '--enso': `url(${ensoSrc})` }"></span>
                  <img
                    v-if="profile.portraitUrl"
                    class="ps-photo"
                    :class="{ 'ps-photo-dead': profile.deceased }"
                    :src="profile.portraitUrl"
                    alt=""
                    draggable="false"
                    decoding="async"
                  />
                  <template v-else>
                    <span class="ps-wash" :style="{ backgroundImage: `url(${washSrc})` }"></span>
                    <span class="ps-mono" :class="{ 'ps-mono-cjk': cjkName }">{{ mono }}</span>
                  </template>
                </button>

                <div class="ps-ident">
                  <div class="ps-name-row">
                    <h1 class="ps-name" :class="{ 'ps-name-v': cjkName }">
                      <span v-for="(w, wi) in nameWords" :key="wi" class="ps-word">
                        <span
                          v-for="(ch, ci) in w.chars"
                          :key="ci + ch"
                          class="ps-ch"
                          :style="{ '--d': w.delay + ci * 0.07 + 's' }"
                          >{{ ch }}</span
                        >
                      </span>
                    </h1>
                    <span v-if="nameSeal" class="ps-seal-wrap">
                      <img class="ps-seal" :src="nameSeal" alt="" draggable="false" />
                    </span>
                  </div>

                  <div class="ps-dates ps-ink" style="--d: 0.25s">
                    <template v-if="person.birth?.year != null || person.death?.year != null">
                      <span>{{ fmtDate(person.birth) || '?' }}</span>
                      <i class="ps-dash"></i>
                      <span>{{ profile.deceased ? fmtDate(person.death) || '?' : 'present' }}</span>
                      <span v-if="profile.age !== null" class="ps-age"
                        >{{ profile.age }} {{ profile.deceased ? 'years' : 'yrs' }}</span
                      >
                    </template>
                    <span v-else class="ps-soft">dates unrecorded</span>
                  </div>

                  <div v-if="facts.length" class="ps-facts ps-ink" style="--d: 0.4s">
                    <span v-for="(f, i) in facts" :key="i">{{ f }}</span>
                  </div>

                  <div v-if="profile.personTags.length" class="ps-slips ps-ink" style="--d: 0.55s">
                    <span
                      v-for="tag in profile.personTags"
                      :key="tag.id"
                      class="ps-slip"
                      :style="{ '--tc': tag.color || 'var(--ps-cinnabar)' }"
                    >
                      <i class="ps-slip-dot"></i>{{ tag.icon ? tag.icon + ' ' : '' }}{{ tag.label }}
                    </span>
                  </div>
                </div>

                <div class="ps-inscr" aria-label="Inscription">
                  <span
                    v-for="(col, i) in inscr"
                    :key="i"
                    class="ps-inscr-col ps-ink"
                    :style="{ '--d': 0.5 + i * 0.25 + 's' }"
                    >{{ col }}</span
                  >
                  <img v-if="smallSeal" class="ps-inscr-seal" :src="smallSeal" alt="" />
                </div>

                <div class="ps-hint" :class="{ 'ps-hint-off': scrolled }" aria-hidden="true">
                  <span>{{ vertical ? 'scroll to unroll' : 'unroll' }}</span>
                  <i class="ps-hint-arrow"></i>
                </div>
              </section>

              <!-- ── 传 · Story ── -->
              <section
                v-if="bioCols.length"
                class="ps-leaf ps-leaf-c"
                :class="seenCls('story')"
                data-leaf="story"
              >
                <header class="ps-lh ps-ink">
                  <img v-if="marks.story" class="ps-mark" :src="marks.story" alt="" />
                  <h2>Story</h2>
                </header>
                <div class="ps-cols">
                  <div
                    v-for="(col, ci) in bioCols"
                    :key="ci"
                    class="ps-col ps-col-text ps-ink"
                    :style="{ '--d': 0.15 + ci * 0.18 + 's' }"
                  >
                    <p
                      v-for="(para, pi) in col"
                      :key="pi"
                      class="ps-para"
                      :class="{
                        'ps-para-cap': ci === 0 && pi === 0 && bioLong,
                        'ps-para-short': !bioLong
                      }"
                    >
                      {{ para }}
                    </p>
                  </div>
                </div>
              </section>

              <!-- ── 家 · Family sketch ── -->
              <section
                v-if="sketch"
                class="ps-leaf ps-leaf-c"
                :class="seenCls('family')"
                data-leaf="family"
              >
                <header class="ps-lh ps-ink">
                  <img v-if="marks.family" class="ps-mark" :src="marks.family" alt="" />
                  <h2>Family</h2>
                  <span class="ps-lh-sub">{{ profile.circleCount }} within two bonds</span>
                </header>
                <div class="ps-sketch-box">
                  <ScrollFamilySketch
                    :style="{ zoom: sketchZoom }"
                    :sketch="sketch"
                    :seed="seed"
                    :active="isSeen('family')"
                    :me-char="mono"
                    :reduce-motion="reduceMotion"
                    @navigate="nav"
                  />
                </div>
              </section>

              <!-- ── 亲 · Bonds (every relationship, named) ── -->
              <section
                v-if="bondCols.length"
                class="ps-leaf ps-leaf-c"
                :class="seenCls('bonds')"
                data-leaf="bonds"
              >
                <header class="ps-lh ps-ink">
                  <img v-if="marks.bonds" class="ps-mark" :src="marks.bonds" alt="" />
                  <h2>Bonds</h2>
                  <span class="ps-lh-sub">{{ profile.relationshipChips.length }}</span>
                </header>
                <div class="ps-cols">
                  <div v-for="(col, ci) in bondCols" :key="ci" class="ps-col">
                    <template v-for="item in col" :key="item.key">
                      <div v-if="item.band" class="ps-band ps-ink" :style="{ '--d': item.d + 's' }">
                        {{ item.band }}
                      </div>
                      <button
                        v-else
                        class="ps-bond ps-ink"
                        :class="{ 'ps-bond-ended': item.chip.ended }"
                        :style="{ '--d': item.d + 's', '--bc': item.chip.color }"
                        @click="nav(item.chip.otherId)"
                      >
                        <span class="ps-bond-name">{{ item.chip.name }}</span>
                        <span class="ps-bond-role"
                          ><i class="ps-bond-dot"></i>{{ item.chip.role
                          }}<template v-if="item.chip.endedYear">
                            · ended {{ item.chip.endedYear }}</template
                          ></span
                        >
                      </button>
                    </template>
                  </div>
                </div>
              </section>

              <!-- ── 族 · Kinship ── -->
              <section
                v-if="profile.relationshipChips.length"
                class="ps-leaf ps-leaf-c ps-leaf-kin"
                :class="seenCls('kin')"
                data-leaf="kin"
              >
                <header class="ps-lh ps-ink">
                  <img v-if="marks.kin" class="ps-mark" :src="marks.kin" alt="" />
                  <h2>Kinship</h2>
                  <span class="ps-lh-sub">family, named</span>
                  <KinLangPicker class="ps-kin-lang" />
                </header>
                <div class="ps-kin-body ps-ink" style="--d: 0.2s">
                  <KinshipSection :person-id="person.id" @navigate="nav" />
                </div>
              </section>

              <!-- ── 性 · Traits ── -->
              <section
                v-if="traitCols.length"
                class="ps-leaf ps-leaf-c"
                :class="seenCls('traits')"
                data-leaf="traits"
              >
                <header class="ps-lh ps-ink">
                  <img v-if="marks.traits" class="ps-mark" :src="marks.traits" alt="" />
                  <h2>Traits</h2>
                  <span class="ps-lh-sub">{{ profile.traitRows.length }}</span>
                </header>
                <div class="ps-cols">
                  <div v-for="(col, ci) in traitCols" :key="ci" class="ps-col ps-col-traits">
                    <div
                      v-for="t in col"
                      :key="t.id"
                      class="ps-trait ps-ink"
                      :class="{ 'ps-trait-para': t.kind === 'para' }"
                      :style="{ '--d': t.d + 's' }"
                    >
                      <div class="ps-trait-k">
                        <span v-if="t.icon" class="ps-trait-icon">{{ t.icon }}</span
                        >{{ t.label }}
                      </div>
                      <div v-if="t.kind === 'slider'" class="ps-slider">
                        <div class="ps-slider-track">
                          <i class="ps-slider-fill" :style="{ '--pct': t.pct + '%' }"></i>
                        </div>
                        <div v-if="t.left || t.right" class="ps-slider-ends">
                          <span>{{ t.left }}</span
                          ><span>{{ t.right }}</span>
                        </div>
                      </div>
                      <div
                        v-else-if="t.kind === 'bool'"
                        class="ps-trait-v"
                        :class="{ 'ps-no': !t.bool }"
                      >
                        {{ t.bool ? 'Yes' : 'No' }}
                      </div>
                      <div v-else-if="t.kind === 'para'" class="ps-trait-p">{{ t.text }}</div>
                      <div v-else class="ps-trait-v">
                        <i v-if="t.color" class="ps-sel-dot" :style="{ background: t.color }"></i
                        >{{ t.text }}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <!-- ── 年 · Chronicle ── -->
              <section
                v-if="chronCols.length"
                class="ps-leaf ps-leaf-c"
                :class="seenCls('chron')"
                data-leaf="chron"
              >
                <header class="ps-lh ps-ink">
                  <img v-if="marks.chron" class="ps-mark" :src="marks.chron" alt="" />
                  <h2>Chronicle</h2>
                </header>
                <div class="ps-cols">
                  <div v-for="(col, ci) in chronCols" :key="ci" class="ps-col ps-col-chron">
                    <div
                      v-for="ev in col"
                      :key="ev.k"
                      class="ps-ev ps-ink"
                      :class="['ps-ev-' + ev.kind, { 'ps-ev-link': !!ev.personId }]"
                      :style="{ '--d': ev.d + 's' }"
                      @click="ev.personId && nav(ev.personId)"
                    >
                      <span class="ps-ev-when">{{ ev.when }}</span>
                      <i class="ps-ev-dot"></i>
                      <span class="ps-ev-title">{{ ev.title }}</span>
                      <span v-if="ev.sub" class="ps-ev-sub">{{ ev.sub }}</span>
                    </div>
                  </div>
                </div>
              </section>

              <!-- ── 画 · Gallery: photos mounted as small hanging scrolls ── -->
              <section
                v-if="profile.images.length"
                class="ps-leaf ps-leaf-c ps-leaf-gal"
                :class="seenCls('gallery')"
                data-leaf="gallery"
              >
                <header class="ps-lh ps-ink">
                  <img v-if="marks.gallery" class="ps-mark" :src="marks.gallery" alt="" />
                  <h2>Gallery</h2>
                  <span class="ps-lh-sub">{{ profile.images.length }}</span>
                </header>
                <div class="ps-gallery">
                  <button
                    v-for="(img, i) in profile.images"
                    :key="img.id"
                    class="ps-mount ps-ink"
                    :style="{ '--d': 0.15 + i * 0.12 + 's' }"
                    @click="emit('lightbox', i)"
                  >
                    <i class="ps-mount-rod ps-mount-rod-t"></i>
                    <span class="ps-mount-silk">
                      <img :src="imageUrl(img.file_path)" alt="" loading="lazy" decoding="async" />
                    </span>
                    <i class="ps-mount-rod ps-mount-rod-b"></i>
                    <span v-if="img.role || img.is_primary" class="ps-mount-cap">
                      {{ img.role || 'primary' }}
                    </span>
                  </button>
                </div>
              </section>

              <!-- ── An empty scroll ── -->
              <section
                v-if="profile.isBlank"
                class="ps-leaf ps-leaf-c ps-blank"
                :class="seenCls('blank')"
                data-leaf="blank"
              >
                <span class="ps-blank-enso" :style="{ '--enso': `url(${ensoSrc})` }"></span>
                <div class="ps-blank-title ps-ink" style="--d: 0.4s">A scroll waiting for ink</div>
                <div class="ps-blank-text ps-ink" style="--d: 0.6s">
                  No traits, bonds or photos yet — open the editor to paint
                  {{ person.name || 'them' }} in.
                </div>
                <button class="ps-blank-cta ps-ink" style="--d: 0.8s" @click="emit('edit')">
                  ✎ Start editing
                </button>
              </section>

              <!-- ── 跋 · Colophon ── -->
              <section class="ps-leaf ps-colo" :class="seenCls('colo')" data-leaf="colo">
                <div class="ps-colo-stats">
                  <div
                    v-for="(s, i) in stats"
                    :key="s.k"
                    class="ps-stat ps-ink"
                    :style="{ '--d': 0.15 + i * 0.12 + 's' }"
                  >
                    <span class="ps-stat-v">{{ s.v }}</span>
                    <span class="ps-stat-k">{{ s.k }}</span>
                  </div>
                </div>
                <div class="ps-colo-end">
                  <span class="ps-colo-col ps-ink" style="--d: 0.6s">{{ colophonLine }}</span>
                  <img v-if="endSeal" class="ps-colo-seal" :src="endSeal" alt="" />
                </div>
              </section>
            </div>
          </div>
        </Transition>
      </div>

      <div class="ps-roller ps-roller-b" aria-hidden="true">
        <i class="ps-knob ps-knob-1"></i><i class="ps-rod"></i><i class="ps-knob ps-knob-2"></i>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useMainStore } from '../../store/index.js'
import { api } from '../../api'
import { INK, hashStr, sealDataUrl, inkFontsReady, installInkAssets } from '../../lib/inkArt'
import { ensoUrl, vDividerUrl, hStrokeUrl, washUrl, landscapeCanvas } from './scrollArt'
import {
  inscription,
  hasCjk,
  monogramChar,
  packColumns,
  packText,
  familySketch,
  textHeight
} from './scrollModel'
import { fmtDate } from './profileFormat'
import ScrollFamilySketch from './ScrollFamilySketch.vue'
import KinshipSection from '../kinship/KinshipSection.vue'
import KinLangPicker from '../kinship/KinLangPicker.vue'

// 卷 — the handscroll (手卷) presentation of the person profile. PersonModal
// owns all state (person, images, chips, traits, chronicle, navigation,
// lightbox, delete…) and hands it over as `profile`; this component only
// paints it: two rollers part to unroll rice paper over a misty landscape
// painted for this person, and the profile is laid out as album leaves that
// soak into the paper as they scroll into view. Phone widths turn it into a
// hanging scroll (立轴) that unrolls downward.

const props = defineProps({
  /** Reactive bundle of PersonModal's state (see PersonModal `profile`). */
  profile: { type: Object, required: true }
})
const emit = defineEmits(['navigate', 'lightbox', 'edit'])
const store = useMainStore()

const person = computed(() => props.profile.person)
const seed = computed(() => hashStr(person.value?.id || 'scroll'))

const reduceMotion =
  typeof window !== 'undefined' &&
  !!window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ── Orientation: handscroll on wide screens, hanging scroll on phones ──────
const mqVert =
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(max-width: 720px)')
    : null
const vertical = ref(!!mqVert?.matches)
function onMq(e) {
  vertical.value = e.matches
}

// ── Assets ─────────────────────────────────────────────────────────────────
const fontsReady = ref(false)
const ensoSrc = computed(() => ensoUrl(seed.value % 97))
const washSrc = computed(() => washUrl(seed.value % 89))
const theme = computed(() => store.theme)

const rootVars = computed(() => {
  const dark = theme.value !== 'light' && theme.value !== 'ink'
  return {
    // the paper is paper in every theme; in the dark it's lamplit, not glowing
    '--ps-paper': dark ? '#ddd3bb' : INK.paper,
    '--ps-paper-l': dark ? '#e6dcc6' : INK.paperLight,
    '--ps-paper-d': dark ? '#cbbf9f' : INK.paperDeep,
    '--ps-ink': INK.ink,
    '--ps-ink-mid': INK.ink2,
    '--ps-ink-soft': INK.wash,
    '--ps-mist': INK.mist,
    '--ps-cinnabar': INK.cinnabar,
    '--ps-cinnabar-d': INK.cinnabarDeep,
    '--ps-indigo': INK.indigo,
    '--ps-malachite': INK.malachite,
    '--ps-ochre': INK.ochre,
    '--ps-gold': INK.gold,
    '--ps-vdiv': `url(${vDividerUrl(seed.value % 13)})`,
    '--ps-hst': `url(${hStrokeUrl(seed.value % 11)})`
  }
})

function sealOrEmpty(text, opts) {
  return fontsReady.value ? sealDataUrl(text, opts) : ''
}
const nameSeal = computed(() =>
  sealOrEmpty(person.value?.name || '?', { size: 168, mode: 'yin', seed: seed.value })
)
const smallSeal = computed(() => sealOrEmpty('家譜', { size: 80, mode: 'yang', seed: 41 }))
const endSeal = computed(() =>
  sealOrEmpty(person.value?.name || '?', {
    size: 132,
    mode: 'yang',
    seed: seed.value + 7,
    round: true
  })
)
const MARK_CHARS = {
  story: '传',
  family: '家',
  bonds: '亲',
  kin: '族',
  traits: '性',
  chron: '年',
  gallery: '画'
}
const marks = computed(() => {
  const out = {}
  for (const [k, ch] of Object.entries(MARK_CHARS))
    out[k] = sealOrEmpty(ch, { size: 72, mode: 'yin', seed: hashStr(ch) })
  return out
})

function imageUrl(p) {
  return api.getImageUrl(p) || ''
}

// ── Identity ───────────────────────────────────────────────────────────────
const cjkName = computed(() => hasCjk(person.value?.name))
const mono = computed(() => monogramChar(person.value?.name))
const nameWords = computed(() => {
  const name = (person.value?.name || 'Unnamed').trim()
  // CJK names are one vertical column; latin names break per word
  const words = cjkName.value ? [name.replace(/\s+/g, '')] : name.split(/\s+/)
  let d = 0
  return words.map((w) => {
    const out = { chars: w.split(''), delay: d }
    d += w.length * 0.07 + 0.12
    return out
  })
})
const facts = computed(() => {
  const p = person.value
  const out = []
  if (p?.gender && p.gender !== 'unknown') out.push(p.gender[0].toUpperCase() + p.gender.slice(1))
  if (p?.occupation) out.push(p.occupation)
  if (p?.location) out.push(p.location)
  return out
})
const inscr = computed(() =>
  inscription({
    birthYear: person.value?.birth?.year ?? null,
    deathYear: person.value?.death?.year ?? null,
    age: props.profile.age
  })
)
const colophonLine = computed(() => `${cjkName.value ? person.value.name : ''}卷终`)
const stats = computed(() => [
  { k: 'Bonds', v: props.profile.statsShown.bonds },
  { k: 'Circle', v: props.profile.statsShown.circle },
  { k: 'Traits', v: props.profile.statsShown.traits },
  { k: 'Photos', v: props.profile.statsShown.photos }
])

function openPortrait() {
  if (props.profile.portraitIndex >= 0) emit('lightbox', props.profile.portraitIndex)
}
function nav(id) {
  emit('navigate', id)
}

// ── Measuring the paper (columns are packed to its height) ─────────────────
const paperEl = ref(null)
const paperW = ref(0)
const paperH = ref(0)
let ro = null

// body height available to a leaf's columns: paper − silk bands − leaf
// padding − header
const colH = computed(() =>
  vertical.value ? Infinity : Math.max(180, paperH.value - 28 - 96 - 72)
)

const bioLong = computed(() => (person.value?.bio || '').length > 140)
const bioCols = computed(() => packText(person.value?.bio || '', colH.value, 300, 16, 1.8))

const traitCols = computed(() => {
  const rows = props.profile.traitRows
  const hs = rows.map((t) =>
    t.kind === 'para'
      ? 52 + textHeight(t.text.length, 270, 14, 1.65)
      : t.kind === 'slider'
        ? 82
        : 66
  )
  return packColumns(hs, colH.value).map((col) =>
    col.map((i) => ({ ...rows[i], d: 0.15 + Math.min(i, 14) * 0.06 }))
  )
})

const chronCols = computed(() => {
  const evs = props.profile.lifeEvents
  const hs = evs.map((e) => 40 + (e.title.length + (e.sub || '').length > 30 ? 20 : 0))
  return packColumns(hs, colH.value).map((col) =>
    col.map((i) => ({ ...evs[i], k: i, d: 0.15 + Math.min(i, 16) * 0.05 }))
  )
})

const bondCols = computed(() => {
  const items = []
  let n = 0
  for (const g of props.profile.bondGroups) {
    items.push({ key: 'b:' + g.key, band: g.label, h: 38, d: 0.1 + Math.min(n++, 16) * 0.05 })
    for (const c of g.chips)
      items.push({ key: c.id, chip: c, h: 52, d: 0.1 + Math.min(n++, 16) * 0.05 })
  }
  const cols = packColumns(
    items.map((i) => i.h),
    colH.value
  ).map((col) => col.map((i) => items[i]))
  // never leave a band label orphaned at the foot of a column
  for (let c = 0; c < cols.length - 1; c++) {
    const last = cols[c][cols[c].length - 1]
    if (last?.band && cols[c].length > 1) cols[c + 1].unshift(cols[c].pop())
  }
  return cols
})

// On a phone the sketch shrinks to the paper's width rather than scroll.
const sketchZoom = computed(() => {
  const w = sketch.value?.w || 1
  if (!vertical.value || !paperW.value) return 1
  return Math.min(1, Math.max(0.5, (paperW.value - 48) / w))
})
const sketch = computed(() =>
  familySketch(
    props.profile.relationshipChips.map((c) => ({
      otherId: c.otherId,
      name: c.name,
      role: c.role,
      side: c.side,
      ended: c.ended
    }))
  )
)

// ── Leaves soak in as they scroll into view ────────────────────────────────
const seen = reactive(new Set())
function isSeen(leaf) {
  return reduceMotion || seen.has(person.value?.id + ':' + leaf)
}
function seenCls(leaf) {
  return { 'ps-seen': isSeen(leaf) }
}
let io = null
function observeLeaves() {
  io?.disconnect()
  const t = trackEl
  if (!t || typeof IntersectionObserver === 'undefined') {
    for (const l of Object.keys(MARK_CHARS).concat(['hero', 'blank', 'colo']))
      seen.add(person.value?.id + ':' + l)
    return
  }
  const pid = person.value?.id
  io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        seen.add(pid + ':' + e.target.dataset.leaf)
        io?.unobserve(e.target)
      }
    },
    { root: t, threshold: 0.12 }
  )
  t.querySelectorAll('.ps-leaf').forEach((el) => io.observe(el))
}

// ── The track (keyed per person — the newest one is live) ──────────────────
let trackEl = null
const scrolled = ref(false)
function trackRef(el) {
  if (el) {
    trackEl = el
    nextTick(() => {
      observeLeaves()
      syncScrollVars()
    })
  }
}

// Wheel → sideways travel, eased; inner vertical scrollers (kinship) keep
// the wheel while they still have room to scroll.
let wheelTarget = null
let wheelRaf = 0
function canScrollY(el, dy) {
  for (let n = el; n && n !== trackEl; n = n.parentElement) {
    if (n.scrollHeight > n.clientHeight + 1) {
      const oy = getComputedStyle(n).overflowY
      if (oy === 'auto' || oy === 'scroll') {
        if (dy < 0 ? n.scrollTop > 0 : n.scrollTop + n.clientHeight < n.scrollHeight - 1)
          return true
      }
    }
  }
  return false
}
function onWheel(e) {
  const t = trackEl
  if (!t || vertical.value || e.ctrlKey) return
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
  if (canScrollY(e.target, e.deltaY)) return
  e.preventDefault()
  const unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? t.clientWidth : 1
  const max = t.scrollWidth - t.clientWidth
  if (wheelTarget === null) wheelTarget = t.scrollLeft
  wheelTarget = Math.max(0, Math.min(max, wheelTarget + e.deltaY * unit * 1.1))
  if (reduceMotion) {
    t.scrollLeft = wheelTarget
    wheelTarget = null
    return
  }
  if (!wheelRaf) wheelRaf = requestAnimationFrame(wheelStep)
}
function wheelStep() {
  wheelRaf = 0
  const t = trackEl
  if (!t || wheelTarget === null) return
  const d = wheelTarget - t.scrollLeft
  if (Math.abs(d) < 0.6) {
    t.scrollLeft = wheelTarget
    wheelTarget = null
    return
  }
  t.scrollLeft += d * 0.2
  wheelRaf = requestAnimationFrame(wheelStep)
}

// Keyboard: ← → / PgUp PgDn / Home End travel along the scroll.
function onKeydown(e) {
  const t = trackEl
  if (!t || !store.modalOpen || props.profile.lightboxOpen) return
  if (store.formOpen || store.curtain?.active || store.appSettingsOpen) return
  const tag = e.target?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable)
    return
  const along = vertical.value ? t.clientHeight : t.clientWidth
  const map = {
    ArrowRight: 0.35,
    ArrowLeft: -0.35,
    PageDown: 0.85,
    PageUp: -0.85,
    End: 1e6,
    Home: -1e6
  }
  if (vertical.value && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) return
  const k = map[e.key]
  if (k == null) return
  e.preventDefault()
  const opts = { behavior: reduceMotion ? 'auto' : 'smooth' }
  if (vertical.value) t.scrollBy({ top: k * along, ...opts })
  else t.scrollBy({ left: k * along, ...opts })
}

// Scroll position drives the painting's parallax and the rollers' grain.
let scrollRaf = 0
function onScroll() {
  if (scrollRaf) return
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0
    syncScrollVars()
  })
}
function syncScrollVars() {
  const t = trackEl
  const root = rootEl.value
  if (!t || !root) return
  const pos = vertical.value ? t.scrollTop : t.scrollLeft
  const max = vertical.value ? t.scrollHeight - t.clientHeight : t.scrollWidth - t.clientWidth
  root.style.setProperty('--ps-p', max > 0 ? (pos / max).toFixed(4) : '0')
  root.style.setProperty('--ps-roll', pos.toFixed(1) + 'px')
  scrolled.value = pos > 30
}
const rootEl = ref(null)

// ── The painting ───────────────────────────────────────────────────────────
const landEls = new Set()
let landTimer = 0
function landRef(el) {
  if (el) {
    landEls.add(el)
    scheduleLand()
  }
}
function scheduleLand() {
  clearTimeout(landTimer)
  // after the first frame of the unroll, so painting never stalls it
  landTimer = setTimeout(paintLands, 60)
}
function paintLands() {
  if (!paperW.value || !paperH.value) return
  const W = Math.round(paperW.value * (vertical.value ? 1 : 1.4))
  const H = Math.round(paperH.value * (vertical.value ? 0.46 : 0.82))
  for (const el of [...landEls]) {
    if (!el.isConnected) {
      landEls.delete(el)
      continue
    }
    const s = Number(el.dataset.seed) || 1
    if (el.dataset.painted === `${W}x${H}`) continue
    const src = landscapeCanvas(W, H, s)
    el.width = src.width
    el.height = src.height
    el.getContext('2d').drawImage(src, 0, 0)
    el.dataset.painted = `${W}x${H}`
    el.classList.add('ps-land-ready')
  }
}

// ── Person-to-person travel ────────────────────────────────────────────────
const quick = ref(false)
const turning = ref(false)
let turnTimer = 0
watch(
  () => person.value?.id,
  (id, old) => {
    if (!id || !old) return
    quick.value = true
    turning.value = !reduceMotion
    wheelTarget = null
    clearTimeout(turnTimer)
    turnTimer = setTimeout(() => (turning.value = false), 1000)
  }
)

onMounted(() => {
  installInkAssets()
  inkFontsReady().then(() => (fontsReady.value = true))
  mqVert?.addEventListener?.('change', onMq)
  window.addEventListener('keydown', onKeydown)
  paperEl.value?.addEventListener('wheel', onWheel, { passive: false })
  if (typeof ResizeObserver !== 'undefined' && paperEl.value) {
    ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect
      paperW.value = Math.round(r.width)
      paperH.value = Math.round(r.height)
      scheduleLand()
      syncScrollVars()
    })
    ro.observe(paperEl.value)
  }
})
onUnmounted(() => {
  mqVert?.removeEventListener?.('change', onMq)
  window.removeEventListener('keydown', onKeydown)
  paperEl.value?.removeEventListener('wheel', onWheel)
  ro?.disconnect()
  io?.disconnect()
  cancelAnimationFrame(wheelRaf)
  cancelAnimationFrame(scrollRaf)
  clearTimeout(landTimer)
  clearTimeout(turnTimer)
})
watch(vertical, () => nextTick(scheduleLand))
</script>

<style scoped>
/* ════════════════════════════ Frame ══════════════════════════════════════ */
.ps {
  --ps-ease: cubic-bezier(0.62, 0.02, 0.24, 1);
  --ps-soft: cubic-bezier(0.25, 0.9, 0.3, 1);
  --ps-halo: 0 0 10px var(--ps-paper), 0 0 4px var(--ps-paper);
  --ps-t0: 0.95s; /* when the leaves start inking in (after the unroll) */
  --ps-p: 0;
  --ps-roll: 0px;
  --roller: 26px;
  position: absolute;
  inset: 0;
  overflow: hidden;
  color: var(--ps-ink);
}

/* The table the scroll lies on — the app's own ground, darkened at the rim */
.ps-table {
  position: absolute;
  inset: 0;
  background: radial-gradient(120% 90% at 50% 45%, transparent 40%, rgba(0, 0, 0, 0.32)), var(--bg);
  animation: ps-fade 0.5s ease both;
}
.ps-th-light .ps-table {
  background:
    radial-gradient(120% 90% at 50% 45%, transparent 45%, rgba(60, 40, 15, 0.12)), var(--bg);
}
.ps-th-ink .ps-table {
  background:
    radial-gradient(120% 90% at 50% 45%, transparent 45%, rgba(60, 40, 15, 0.16)),
    var(--ink-paper, none) 0 0 / 512px 512px,
    var(--bg);
}

.ps-scroll {
  position: absolute;
  top: 66px;
  bottom: 24px;
  left: 22px;
  right: 22px;
  container-type: size;
}

/* ════════════════════════════ Rollers (轴) ════════════════════════════════ */
.ps-roller {
  position: absolute;
  top: -14px;
  bottom: -14px;
  width: var(--roller);
  z-index: 4;
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: ps-roller-in 1.45s var(--ps-ease) both;
}
.ps-roller-a {
  left: 0;
  --from: calc(50cqw - var(--roller));
}
.ps-roller-b {
  right: 0;
  --from: calc(var(--roller) - 50cqw);
}
@keyframes ps-roller-in {
  0% {
    opacity: 0;
    transform: translateX(var(--from)) translateY(-18px);
  }
  14% {
    opacity: 1;
    transform: translateX(var(--from));
  }
  24% {
    transform: translateX(var(--from));
  }
  to {
    transform: none;
  }
}
.ps-rod {
  flex: 1;
  width: 100%;
  border-radius: 4px;
  /* lacquered wood: a lit cylinder, with grain that turns as the paper winds */
  background:
    linear-gradient(
      90deg,
      rgba(0, 0, 0, 0.45),
      rgba(255, 230, 190, 0.22) 32%,
      rgba(255, 240, 210, 0.08) 45%,
      rgba(0, 0, 0, 0.2) 70%,
      rgba(0, 0, 0, 0.55)
    ),
    repeating-linear-gradient(
      90deg,
      transparent 0 5px,
      rgba(0, 0, 0, 0.14) 5px 6px,
      transparent 6px 11px,
      rgba(255, 220, 170, 0.06) 11px 12px
    ),
    color-mix(in srgb, var(--ps-ochre) 38%, var(--ps-ink));
  background-position:
    0 0,
    calc(var(--ps-roll) * -0.6) 0,
    0 0;
  box-shadow:
    0 10px 24px -8px rgba(0, 0, 0, 0.55),
    0 2px 4px rgba(0, 0, 0, 0.3);
}
.ps-turning .ps-rod {
  animation: ps-turn 1s var(--ps-ease);
}
@keyframes ps-turn {
  from {
    background-position:
      0 0,
      -60px 0,
      0 0;
  }
}
/* jade end caps (轴头) */
.ps-knob {
  flex: 0 0 auto;
  width: calc(var(--roller) + 8px);
  height: 16px;
  border-radius: 6px;
  background:
    linear-gradient(
      90deg,
      rgba(0, 0, 0, 0.35),
      rgba(255, 255, 255, 0.35) 35%,
      rgba(255, 255, 255, 0.05) 55%,
      rgba(0, 0, 0, 0.35)
    ),
    color-mix(in srgb, var(--ps-malachite) 55%, var(--ps-paper));
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.3);
}
.ps-knob-1 {
  margin-bottom: -3px;
}
.ps-knob-2 {
  margin-top: -3px;
}

/* ════════════════════════════ Paper (纸) ══════════════════════════════════ */
.ps-paper {
  position: absolute;
  top: 0;
  bottom: 0;
  left: calc(var(--roller) - 6px);
  right: calc(var(--roller) - 6px);
  z-index: 2;
  overflow: hidden;
  isolation: isolate;
  background:
    var(--ink-paper-light, none) 0 0 / 512px 512px,
    radial-gradient(140% 120% at 50% 50%, transparent 55%, rgba(120, 90, 45, 0.16)),
    var(--ps-paper);
  background-blend-mode: multiply, normal, normal;
  box-shadow: 0 24px 60px -24px rgba(0, 0, 0, 0.55);
  /* the CSS tokens inside the paper are paper tokens, whatever the app theme
     — so embedded components (KinshipSection) read as ink on paper */
  --t1: var(--ps-ink);
  --t2: var(--ps-ink-mid);
  --t3: var(--ps-ink-soft);
  --bg: var(--ps-paper);
  --surface: var(--ps-paper-l);
  --elevated: color-mix(in srgb, var(--ps-paper-d) 70%, var(--ps-paper));
  --hover: var(--ps-paper-d);
  --border: rgba(48, 36, 20, 0.16);
  --border-strong: rgba(48, 36, 20, 0.3);
  --glass-strong: color-mix(in srgb, var(--ps-paper-l) 70%, transparent);
  --glass-soft: color-mix(in srgb, var(--ps-paper-l) 85%, transparent);
  --accent: var(--ps-cinnabar);
  --accent-rgb: 179, 53, 42;
  --on-accent: var(--ps-paper-l);
  --kin-blood: var(--ps-cinnabar);
  --kin-spouse: #a2496a;
  --kin-marriage: #3f7f7a;
  --kin-step: #6b5a8e;
  --kin-social: #4f7d5c;
  --kin-distant: #857a68;
  --font: var(--font-ink-serif);
  color-scheme: light;
  animation: ps-unroll 1.45s var(--ps-ease) both;
}
@keyframes ps-unroll {
  0%,
  24% {
    clip-path: inset(0 calc(50% - 4px) 0 calc(50% - 4px));
  }
  to {
    clip-path: inset(0 0 0 0);
  }
}
/* paper curling onto the rollers */
.ps-paper::before,
.ps-paper::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 46px;
  z-index: 6;
  pointer-events: none;
}
.ps-paper::before {
  left: 0;
  background: linear-gradient(90deg, rgba(60, 40, 15, 0.26), transparent);
}
.ps-paper::after {
  right: 0;
  background: linear-gradient(-90deg, rgba(60, 40, 15, 0.26), transparent);
}

/* silk mounting bands (天头/地头) */
.ps-silk {
  position: absolute;
  left: 0;
  right: 0;
  height: 14px;
  z-index: 5;
  pointer-events: none;
  background:
    repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.07) 0 2px, transparent 2px 6px),
    repeating-linear-gradient(-45deg, rgba(0, 0, 0, 0.06) 0 2px, transparent 2px 6px),
    color-mix(in srgb, var(--ps-indigo) 62%, var(--ps-ochre));
}
.ps-silk-1 {
  top: 0;
  box-shadow: 0 1px 0 rgba(28, 26, 23, 0.4);
}
.ps-silk-2 {
  bottom: 0;
  box-shadow: 0 -1px 0 rgba(28, 26, 23, 0.4);
}

/* ── the landscape ── */
.ps-land-wrap {
  position: absolute;
  left: 0;
  bottom: 14px;
  width: 140%;
  height: 82%;
  z-index: 0;
  pointer-events: none;
  transform: translateX(calc(var(--ps-p) * -28.5%));
  will-change: transform;
}
.ps-land {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  transition: opacity 1.6s ease;
}
.ps-land.ps-land-ready {
  opacity: 0.92;
}
.ps-land-enter-active,
.ps-land-leave-active {
  transition: opacity 1.1s ease;
}
.ps-land-leave-to {
  opacity: 0 !important;
}

/* drifting mist — paper-coloured clouds sliding slowly across */
.ps-mist {
  position: absolute;
  left: -20%;
  width: 140%;
  pointer-events: none;
  z-index: 1;
  will-change: transform;
}
.ps-mist-a {
  top: 46%;
  height: 22%;
  background:
    radial-gradient(
      28% 50% at 18% 50%,
      color-mix(in srgb, var(--ps-paper) 80%, transparent),
      transparent 72%
    ),
    radial-gradient(
      22% 46% at 52% 60%,
      color-mix(in srgb, var(--ps-paper) 70%, transparent),
      transparent 72%
    ),
    radial-gradient(
      30% 50% at 84% 45%,
      color-mix(in srgb, var(--ps-paper) 75%, transparent),
      transparent 72%
    );
  animation: ps-mist-a 70s ease-in-out infinite alternate;
}
.ps-mist-b {
  top: 70%;
  height: 20%;
  background:
    radial-gradient(
      26% 50% at 30% 50%,
      color-mix(in srgb, var(--ps-paper) 85%, transparent),
      transparent 70%
    ),
    radial-gradient(
      30% 50% at 72% 55%,
      color-mix(in srgb, var(--ps-paper) 80%, transparent),
      transparent 70%
    );
  animation: ps-mist-b 90s ease-in-out infinite alternate;
}
@keyframes ps-mist-a {
  from {
    transform: translateX(-4%);
  }
  to {
    transform: translateX(6%);
  }
}
@keyframes ps-mist-b {
  from {
    transform: translateX(5%);
  }
  to {
    transform: translateX(-6%);
  }
}

/* ════════════════════════════ Track & leaves ═════════════════════════════ */
.ps-track {
  position: absolute;
  top: 14px;
  bottom: 14px;
  left: 0;
  right: 0;
  z-index: 3;
  overflow-x: auto;
  overflow-y: hidden;
  outline: none;
  scrollbar-width: thin;
  scrollbar-color: rgba(28, 26, 23, 0.25) transparent;
}
.ps-track::-webkit-scrollbar {
  height: 6px;
}
.ps-track::-webkit-scrollbar-thumb {
  background: rgba(28, 26, 23, 0.22);
  border-radius: 3px;
}
.ps-track.ps-quick {
  --ps-t0: 0.15s;
}
.ps-leaves {
  display: flex;
  align-items: stretch;
  height: 100%;
  width: max-content;
  padding: 0 70px 0 50px;
}
.ps-leaf {
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 44px 46px 52px 58px;
}
/* a dry vertical stroke between leaves */
.ps-leaf + .ps-leaf::before {
  content: '';
  position: absolute;
  left: 4px;
  top: 9%;
  bottom: 9%;
  width: 16px;
  background-color: var(--ps-ink);
  -webkit-mask: var(--ps-vdiv) center / 100% 100% no-repeat;
  mask: var(--ps-vdiv) center / 100% 100% no-repeat;
  opacity: 0;
  clip-path: inset(0 0 100% 0);
}
.ps-leaf.ps-seen + .ps-leaf::before,
.ps-leaf + .ps-leaf.ps-seen::before {
  animation: ps-div-in 1.2s var(--ps-soft) 0.1s forwards;
}
@keyframes ps-div-in {
  to {
    opacity: 0.4;
    clip-path: inset(0 0 0 0);
  }
}
/* content leaves pool a little mist behind their text (留白 on the painting) */
.ps-leaf-c::after {
  content: '';
  position: absolute;
  inset: 4% 0 2% 22px;
  z-index: -1;
  background: radial-gradient(
    closest-side,
    color-mix(in srgb, var(--ps-paper) 94%, transparent) 62%,
    color-mix(in srgb, var(--ps-paper) 55%, transparent) 84%,
    transparent
  );
  transform: scale(1.12, 1.06);
  pointer-events: none;
}

/* ink soaking into paper — every .ps-ink waits for its leaf to be seen */
.ps-ink {
  opacity: 0;
}
.ps-seen .ps-ink {
  animation: ps-soak 1.15s var(--ps-soft) calc(var(--d, 0s) + 0.05s) forwards;
}
.ps-seen.ps-hero .ps-ink {
  animation-delay: calc(var(--ps-t0) + var(--d, 0s));
}
@keyframes ps-soak {
  from {
    opacity: 0;
    filter: blur(5px);
    transform: translateY(5px);
  }
  55% {
    opacity: 0.85;
    filter: blur(0.8px);
  }
  to {
    opacity: 1;
    filter: none;
    transform: none;
  }
}

/* leaf header: seal mark + calligraphic title, on a brush rule */
.ps-lh {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 52px;
  margin-bottom: 20px;
  flex-shrink: 0;
}
.ps-lh::after {
  content: '';
  position: absolute;
  left: 46px;
  right: -10px;
  bottom: -9px;
  height: 9px;
  background-color: var(--ps-ink);
  -webkit-mask: var(--ps-hst) left center / 100% 100% no-repeat;
  mask: var(--ps-hst) left center / 100% 100% no-repeat;
  opacity: 0.34;
}
.ps-mark {
  width: 34px;
  height: 34px;
  mix-blend-mode: multiply;
  transform: rotate(-3deg);
}
.ps-lh h2 {
  margin: 0;
  font-family: var(--font-brush);
  font-weight: 400;
  font-size: 30px;
  letter-spacing: 0.02em;
  color: var(--ps-ink);
  text-shadow: var(--ps-halo);
}
.ps-lh-sub {
  font-family: var(--font-ink-serif);
  font-style: italic;
  font-size: 13.5px;
  color: var(--ps-ink-soft);
  white-space: nowrap;
}
.ps-cols {
  display: flex;
  gap: 40px;
  flex: 1;
  min-height: 0;
}
.ps-col {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
}
.ps-col::-webkit-scrollbar {
  display: none;
}

/* ════════════════════════════ Hero ═══════════════════════════════════════ */
.ps-hero {
  flex-direction: row;
  align-items: center;
  gap: clamp(28px, 4cqw, 64px);
  padding: 30px 40px 40px 30px;
  min-width: min(calc(100cqw - 120px), 1080px);
}

.ps-portrait {
  --psz: min(56cqh, 420px, 34cqw);
  position: relative;
  flex: 0 0 auto;
  width: var(--psz);
  height: var(--psz);
  padding: 0;
  border: none;
  background: none;
  cursor: default;
  border-radius: 50%;
}
.ps-portrait-photo {
  cursor: zoom-in;
}
.ps-enso {
  position: absolute;
  inset: -9%;
  z-index: 2;
  background: var(--enso) center / contain no-repeat;
  pointer-events: none;
  -webkit-mask: conic-gradient(from -18deg, #000 var(--sweep), transparent var(--sweep));
  mask: conic-gradient(from -18deg, #000 var(--sweep), transparent var(--sweep));
  --sweep: 0deg;
  animation: ps-enso calc(1.5s) cubic-bezier(0.45, 0.05, 0.35, 1) calc(var(--ps-t0) - 0.25s)
    forwards;
}
@property --sweep {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}
@keyframes ps-enso {
  to {
    --sweep: 362deg;
  }
}
.ps-photo {
  position: absolute;
  inset: 8%;
  width: 84%;
  height: 84%;
  object-fit: cover;
  border-radius: 50%;
  /* ink-toned print laid into the paper */
  filter: grayscale(0.92) sepia(0.32) contrast(1.12) brightness(1.04);
  mix-blend-mode: multiply;
  -webkit-mask: radial-gradient(closest-side, #000 72%, transparent 100%);
  mask: radial-gradient(closest-side, #000 72%, transparent 100%);
  opacity: 0;
  animation: ps-photo-in 1.8s var(--ps-soft) calc(var(--ps-t0) - 0.35s) forwards;
  transition: filter 1.2s ease;
}
.ps-portrait:hover .ps-photo {
  filter: grayscale(0.25) sepia(0.15) contrast(1.05);
}
.ps-photo-dead {
  filter: grayscale(1) sepia(0.4) contrast(1.1) brightness(1.06);
}
@keyframes ps-photo-in {
  from {
    opacity: 0;
    filter: grayscale(1) sepia(0.3) blur(10px) contrast(0.8);
    transform: scale(1.04);
  }
  to {
    opacity: 0.94;
  }
}
.ps-wash {
  position: absolute;
  inset: 4%;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  opacity: 0;
  animation: ps-bloom 2s var(--ps-soft) calc(var(--ps-t0) - 0.3s) forwards;
}
@keyframes ps-bloom {
  from {
    opacity: 0;
    transform: scale(0.6);
    filter: blur(8px);
  }
  to {
    opacity: 0.75;
  }
}
.ps-mono {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-xing);
  font-size: calc(var(--psz) * 0.52);
  line-height: 1;
  color: var(--ps-ink);
  padding-bottom: 4%;
  opacity: 0;
  animation: ps-soak 1.4s var(--ps-soft) calc(var(--ps-t0) + 0.05s) forwards;
}
.ps-mono-cjk {
  font-family: var(--font-brush);
  font-size: calc(var(--psz) * 0.46);
}

.ps-ident {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  max-width: 520px;
}
.ps-name-row {
  display: flex;
  align-items: flex-start;
  gap: 18px;
}
.ps-name {
  margin: 0;
  display: flex;
  flex-direction: column;
  font-family: var(--font-brush);
  font-weight: 400;
  font-size: clamp(46px, min(9cqh, 6.4cqw), 92px);
  line-height: 1.02;
  letter-spacing: 0.01em;
  color: var(--ps-ink);
  text-shadow: var(--ps-halo);
  word-break: break-word;
}
.ps-name-v {
  writing-mode: vertical-rl;
  flex-direction: row;
  font-size: clamp(54px, 11cqh, 110px);
  letter-spacing: 0.12em;
}
.ps-word {
  white-space: nowrap;
}
.ps-ch {
  display: inline-block;
  opacity: 0;
  animation: ps-write 0.9s var(--ps-soft) calc(var(--ps-t0) + 0.1s + var(--d)) forwards;
}
@keyframes ps-write {
  from {
    opacity: 0;
    filter: blur(6px);
    transform: translateY(4px) scale(1.08);
    clip-path: inset(-30% 100% -30% -30%);
  }
  35% {
    opacity: 1;
  }
  to {
    opacity: 1;
    filter: none;
    transform: none;
    clip-path: inset(-30% -30% -30% -30%);
  }
}
.ps-name-v .ps-ch {
  animation-name: ps-write-v;
}
@keyframes ps-write-v {
  from {
    opacity: 0;
    filter: blur(6px);
    clip-path: inset(-30% -30% 100% -30%);
  }
  35% {
    opacity: 1;
  }
  to {
    opacity: 1;
    filter: none;
    clip-path: inset(-30% -30% -30% -30%);
  }
}

/* the name seal stamps down onto the paper */
.ps-seal-wrap {
  position: relative;
  flex: 0 0 auto;
  margin-top: 10px;
}
.ps-seal {
  display: block;
  width: clamp(54px, 8cqh, 76px);
  height: auto;
  mix-blend-mode: multiply;
  opacity: 0;
  transform-origin: 50% 60%;
  animation: ps-stamp 0.75s cubic-bezier(0.3, 1.25, 0.5, 1) calc(var(--ps-t0) + 0.75s) forwards;
}
.ps-seal-wrap::after {
  /* paste squeezed out by the press: a quick cinnabar bloom */
  content: '';
  position: absolute;
  inset: -30%;
  border-radius: 50%;
  background: radial-gradient(closest-side, rgba(179, 53, 42, 0.28), transparent);
  opacity: 0;
  pointer-events: none;
  animation: ps-press 0.9s ease-out calc(var(--ps-t0) + 1.05s) forwards;
}
@keyframes ps-stamp {
  0% {
    opacity: 0;
    transform: translateY(-26px) scale(1.6) rotate(-10deg);
    filter: drop-shadow(0 22px 14px rgba(0, 0, 0, 0.3));
  }
  45% {
    opacity: 1;
    transform: translateY(0) scale(0.92) rotate(-2deg);
    filter: drop-shadow(0 0 0 rgba(0, 0, 0, 0));
  }
  65% {
    transform: scale(1.03) rotate(-3deg);
  }
  to {
    opacity: 0.94;
    transform: scale(1) rotate(-3deg);
  }
}
@keyframes ps-press {
  0% {
    opacity: 0.9;
    transform: scale(0.5);
  }
  to {
    opacity: 0;
    transform: scale(1.3);
  }
}

.ps-dates {
  display: flex;
  align-items: center;
  gap: 12px;
  font-family: var(--font-brush);
  font-size: 26px;
  color: var(--ps-ink-mid);
  text-shadow: var(--ps-halo);
}
.ps-dash {
  width: 46px;
  height: 10px;
  background-color: var(--ps-ink);
  -webkit-mask: var(--ps-hst) center / 100% 100% no-repeat;
  mask: var(--ps-hst) center / 100% 100% no-repeat;
  opacity: 0.6;
}
.ps-age {
  font-family: var(--font-ink-serif);
  font-style: italic;
  font-size: 15px;
  color: var(--ps-cinnabar);
  margin-left: 4px;
}
.ps-soft {
  font-family: var(--font-ink-serif);
  font-style: italic;
  font-size: 15px;
  color: var(--ps-ink-soft);
}
.ps-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  font-family: var(--font-ink-serif);
  font-style: italic;
  font-size: 16px;
  color: var(--ps-ink-mid);
  text-shadow: var(--ps-halo);
}
.ps-facts span + span::before {
  content: '·';
  margin-right: 16px;
  color: var(--ps-cinnabar);
  font-style: normal;
}
.ps-slips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.ps-slip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 3px 12px 4px;
  font-family: var(--font-brush);
  font-size: 15px;
  color: var(--ps-ink);
  background: color-mix(in srgb, var(--ps-paper-l) 80%, transparent);
  border: 1px solid color-mix(in srgb, var(--tc) 55%, var(--ps-ink-soft));
  border-radius: 2px 4px 3px 5px / 4px 2px 5px 3px;
}
.ps-slip-dot {
  width: 7px;
  height: 7px;
  border-radius: 50% 40% 55% 45%;
  background: var(--tc);
}

/* vertical inscription column (题款) */
.ps-inscr {
  align-self: center;
  display: flex;
  flex-direction: row-reverse;
  align-items: flex-start;
  gap: 10px;
  margin-left: auto;
  padding: 0 6px;
}
.ps-inscr-col {
  writing-mode: vertical-rl;
  font-family: var(--font-xing);
  font-size: clamp(20px, 3.2cqh, 28px);
  letter-spacing: 0.14em;
  line-height: 1;
  color: var(--ps-ink-mid);
  text-shadow: var(--ps-halo);
}
.ps-inscr-seal {
  align-self: flex-end;
  width: 30px;
  mix-blend-mode: multiply;
  opacity: 0;
  animation: ps-stamp 0.6s cubic-bezier(0.3, 1.25, 0.5, 1) calc(var(--ps-t0) + 1.3s) forwards;
}

.ps-hint {
  position: absolute;
  right: 34px;
  bottom: 30px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: var(--font-ink-serif);
  font-style: italic;
  font-size: 13px;
  color: var(--ps-ink-soft);
  opacity: 0;
  animation: ps-fade 1s ease calc(var(--ps-t0) + 1.8s) forwards;
  transition: opacity 0.6s ease;
  pointer-events: none;
}
.ps-hint-off {
  opacity: 0 !important;
  animation: none;
}
.ps-hint-arrow {
  width: 54px;
  height: 9px;
  background-color: var(--ps-ink-soft);
  -webkit-mask: var(--ps-hst) center / 100% 100% no-repeat;
  mask: var(--ps-hst) center / 100% 100% no-repeat;
  animation: ps-nudge 2.6s ease-in-out infinite;
}
@keyframes ps-nudge {
  50% {
    transform: translateX(8px);
  }
}

/* ════════════════════════════ Story ══════════════════════════════════════ */
.ps-col-text {
  width: 300px;
}
.ps-para {
  margin: 0 0 0.9em;
  font-family: var(--font-ink-serif);
  font-size: 16px;
  line-height: 1.8;
  color: var(--ps-ink-mid);
  white-space: pre-wrap;
}
.ps-para-short {
  max-width: 300px;
  font-family: var(--font-brush);
  font-size: 25px;
  line-height: 1.55;
  color: var(--ps-ink);
}
.ps-para-cap::first-letter {
  float: left;
  font-family: var(--font-xing);
  font-size: 58px;
  line-height: 0.9;
  padding: 6px 10px 0 0;
  color: var(--ps-ink);
}

/* ════════════════════════════ Family ═════════════════════════════════════ */
.ps-sketch-box {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  scrollbar-width: none;
}

/* ════════════════════════════ Bonds ══════════════════════════════════════ */
.ps-col:has(.ps-bond) {
  width: 250px;
}
.ps-band {
  height: 38px;
  display: flex;
  align-items: flex-end;
  padding-bottom: 6px;
  font-family: var(--font-ink-serif);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--ps-cinnabar);
}
.ps-bond {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  height: 52px;
  padding: 0 0 0 2px;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
  font-family: var(--font-ink-serif);
}
.ps-bond-name {
  position: relative;
  font-family: var(--font-brush);
  font-size: 22px;
  line-height: 1.1;
  color: var(--ps-ink);
  transition: color 0.3s ease;
}
.ps-bond-name::after {
  content: '';
  position: absolute;
  left: -4%;
  right: -4%;
  bottom: -5px;
  height: 7px;
  background-color: var(--ps-cinnabar);
  -webkit-mask: var(--ps-hst) center / 100% 100% no-repeat;
  mask: var(--ps-hst) center / 100% 100% no-repeat;
  clip-path: inset(0 100% 0 0);
  transition: clip-path 0.5s var(--ps-soft);
  opacity: 0.7;
}
.ps-bond:hover .ps-bond-name,
.ps-bond:focus-visible .ps-bond-name {
  color: var(--ps-cinnabar-d);
}
.ps-bond:hover .ps-bond-name::after,
.ps-bond:focus-visible .ps-bond-name::after {
  clip-path: inset(0 0 0 0);
}
.ps-bond-role {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 3px;
  font-size: 13px;
  font-style: italic;
  color: var(--ps-ink-soft);
}
.ps-bond-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--bc, var(--ps-ink)) 70%, var(--ps-ink));
}
.ps-bond-ended .ps-bond-name {
  color: var(--ps-ink-soft);
  text-decoration: line-through;
  text-decoration-thickness: 1px;
}

/* ════════════════════════════ Kinship ════════════════════════════════════ */
.ps-leaf-kin {
  width: min(720px, 80cqw);
}
.ps-kin-lang {
  margin-left: auto;
}
.ps-kin-body :deep(.ks-chip) {
  border-radius: 2px 5px 3px 6px / 5px 2px 6px 3px;
  background: color-mix(in srgb, var(--ps-paper-l) 70%, transparent);
  border-color: color-mix(in srgb, var(--kc) 35%, rgba(48, 36, 20, 0.18));
}
.ps-kin-body :deep(.ks-chip:hover) {
  box-shadow: none;
}
.ps-kin-body :deep(.ks-name) {
  font-family: var(--font-brush);
  font-size: 16px;
  font-weight: 400;
}
.ps-kin-body :deep(.ks-rel) {
  font-family: var(--font-ink-serif);
  font-style: italic;
  text-transform: none;
  letter-spacing: 0;
}
.ps-kin-body :deep(.ks-av) {
  filter: saturate(0.4) sepia(0.2);
  border-radius: 50% 44% 52% 46%;
}
.ps-kin-body :deep(.ks-side) {
  background: transparent;
  border-color: transparent;
  box-shadow: none;
  backdrop-filter: none;
}
.ps-kin-body :deep(.ks-stat-v) {
  font-family: var(--font-brush);
  font-weight: 400;
  font-size: 22px;
}
.ps-kin-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 8px;
  scrollbar-width: thin;
}

/* ════════════════════════════ Traits ═════════════════════════════════════ */
.ps-col-traits {
  width: 270px;
  gap: 0;
}
.ps-trait {
  padding: 8px 0 14px;
}
.ps-trait-k {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-ink-serif);
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--ps-ink-soft);
}
.ps-trait-icon {
  font-size: 13px;
  letter-spacing: 0;
}
.ps-trait-v {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  font-family: var(--font-brush);
  font-size: 23px;
  line-height: 1.15;
  color: var(--ps-ink);
}
.ps-no {
  color: var(--ps-ink-soft);
}
.ps-trait-p {
  margin-top: 6px;
  font-family: var(--font-ink-serif);
  font-size: 14px;
  line-height: 1.65;
  color: var(--ps-ink-mid);
  white-space: pre-wrap;
}
.ps-sel-dot {
  width: 10px;
  height: 10px;
  border-radius: 50% 44% 52% 46%;
  opacity: 0.85;
}
.ps-slider {
  margin-top: 8px;
}
.ps-slider-track {
  position: relative;
  height: 12px;
}
.ps-slider-track::before,
.ps-slider-fill {
  content: '';
  position: absolute;
  inset: 0;
  -webkit-mask: var(--ps-hst) center / 100% 100% no-repeat;
  mask: var(--ps-hst) center / 100% 100% no-repeat;
}
.ps-slider-track::before {
  background-color: var(--ps-ink);
  opacity: 0.14;
}
.ps-slider-fill {
  background-color: var(--ps-ink);
  opacity: 0.78;
  clip-path: inset(0 100% 0 0);
}
.ps-seen .ps-slider-fill {
  animation: ps-fill 1.3s var(--ps-soft) 0.5s forwards;
}
@keyframes ps-fill {
  to {
    clip-path: inset(0 calc(100% - var(--pct)) 0 0);
  }
}
.ps-slider-ends {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  font-family: var(--font-ink-serif);
  font-style: italic;
  font-size: 12px;
  color: var(--ps-ink-soft);
}

/* ════════════════════════════ Chronicle ══════════════════════════════════ */
.ps-col-chron {
  position: relative;
  width: 300px;
  padding-left: 4px;
}
.ps-ev {
  display: grid;
  grid-template-columns: 78px 16px 1fr;
  align-items: baseline;
  column-gap: 8px;
  min-height: 40px;
  padding: 6px 0;
}
.ps-ev-link {
  cursor: pointer;
}
.ps-ev-link:hover .ps-ev-title {
  color: var(--ps-cinnabar-d);
}
.ps-ev-when {
  font-family: var(--font-brush);
  font-size: 18px;
  color: var(--ps-ink-mid);
  text-align: right;
}
.ps-ev-dot {
  justify-self: center;
  width: 9px;
  height: 9px;
  border-radius: 50% 44% 52% 46%;
  background: var(--ps-ink);
  opacity: 0.75;
}
.ps-ev-birth .ps-ev-dot,
.ps-ev-union .ps-ev-dot {
  background: var(--ps-cinnabar);
  opacity: 0.9;
}
.ps-ev-child .ps-ev-dot {
  background: var(--ps-malachite);
}
.ps-ev-ended .ps-ev-dot {
  background: transparent;
  box-shadow: inset 0 0 0 1.5px var(--ps-ink-soft);
}
.ps-ev-title {
  font-family: var(--font-ink-serif);
  font-size: 15px;
  color: var(--ps-ink);
  transition: color 0.3s ease;
}
.ps-ev-sub {
  grid-column: 3;
  font-family: var(--font-ink-serif);
  font-style: italic;
  font-size: 12.5px;
  color: var(--ps-ink-soft);
}

/* ════════════════════════════ Gallery ════════════════════════════════════ */
.ps-gallery {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  gap: 34px;
  padding: 0 6px;
}
.ps-mount {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: min(78%, 420px);
  padding: 0;
  border: none;
  background: none;
  cursor: zoom-in;
  transition: transform 0.6s var(--ps-soft);
}
.ps-mount:hover {
  transform: translateY(-6px) rotate(-0.6deg);
}
.ps-mount-rod {
  width: calc(100% + 14px);
  height: 9px;
  border-radius: 4px;
  background:
    linear-gradient(180deg, rgba(255, 230, 190, 0.25), rgba(0, 0, 0, 0.35)),
    color-mix(in srgb, var(--ps-ochre) 38%, var(--ps-ink));
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.25);
  flex-shrink: 0;
}
.ps-mount-rod-b {
  height: 11px;
}
.ps-mount-silk {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  /* 天头 (heaven) is always taller than 地头 (earth) */
  padding: 40px 14px 22px;
  background:
    repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.07) 0 2px, transparent 2px 6px),
    color-mix(in srgb, var(--ps-ochre) 30%, var(--ps-paper-d));
  box-shadow:
    inset 0 0 0 1px rgba(28, 26, 23, 0.22),
    0 16px 30px -16px rgba(0, 0, 0, 0.45);
}
/* 惊燕 — the two silk strips hanging from the top of a scroll */
.ps-mount-silk::before,
.ps-mount-silk::after {
  content: '';
  position: absolute;
  top: 0;
  width: 6px;
  height: 40px;
  background: color-mix(in srgb, var(--ps-indigo) 55%, var(--ps-paper-d));
  box-shadow: inset 0 0 0 1px rgba(28, 26, 23, 0.15);
  opacity: 0.85;
  z-index: 1;
}
.ps-mount-silk::before {
  left: 34%;
}
.ps-mount-silk::after {
  right: 34%;
}
/* the hanging cord above the top rod */
.ps-mount::before {
  content: '';
  position: absolute;
  top: -22px;
  left: 50%;
  width: 46px;
  height: 22px;
  margin-left: -23px;
  border-top: 1.5px solid color-mix(in srgb, var(--ps-ochre) 50%, var(--ps-ink));
  border-left: 1.5px solid color-mix(in srgb, var(--ps-ochre) 50%, var(--ps-ink));
  transform: rotate(45deg) scale(0.75);
  transform-origin: 50% 100%;
  opacity: 0.7;
}
.ps-mount-silk img {
  height: 100%;
  width: auto;
  max-width: 300px;
  object-fit: cover;
  box-shadow:
    0 0 0 4px var(--ps-paper-l),
    0 0 0 5px rgba(28, 26, 23, 0.25);
  filter: grayscale(0.85) sepia(0.3) contrast(1.08);
  transition: filter 1s ease;
}
.ps-mount:hover .ps-mount-silk img {
  filter: none;
}
.ps-mount-cap {
  position: absolute;
  right: -26px;
  top: 34px;
  writing-mode: vertical-rl;
  font-family: var(--font-brush);
  font-size: 15px;
  letter-spacing: 0.1em;
  color: var(--ps-ink-mid);
  text-transform: capitalize;
}

/* ════════════════════════════ Blank ══════════════════════════════════════ */
.ps-blank {
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 440px;
  text-align: center;
}
.ps-blank-enso {
  width: 130px;
  height: 130px;
  background: var(--enso) center / contain no-repeat;
  opacity: 0.8;
  -webkit-mask: conic-gradient(from -18deg, #000 var(--sweep), transparent var(--sweep));
  mask: conic-gradient(from -18deg, #000 var(--sweep), transparent var(--sweep));
}
.ps-seen .ps-blank-enso {
  animation: ps-enso 1.5s cubic-bezier(0.45, 0.05, 0.35, 1) 0.1s forwards;
}
.ps-blank-title {
  font-family: var(--font-brush);
  font-size: 28px;
  color: var(--ps-ink);
}
.ps-blank-text {
  font-family: var(--font-ink-serif);
  font-style: italic;
  font-size: 15px;
  color: var(--ps-ink-soft);
  max-width: 340px;
}
.ps-blank-cta {
  margin-top: 8px;
  padding: 8px 20px 9px;
  border: none;
  border-radius: 3px 5px 4px 6px / 5px 3px 6px 4px;
  background: var(--ps-cinnabar);
  color: var(--ps-paper-l);
  font-family: var(--font-brush);
  font-size: 17px;
  letter-spacing: 0.04em;
  cursor: pointer;
  box-shadow: 0 3px 10px rgba(140, 36, 28, 0.25);
  transition:
    transform 0.25s var(--ps-soft),
    background 0.25s ease;
}
.ps-blank-cta:hover {
  background: var(--ps-cinnabar-d);
  transform: translateY(-1px);
}

/* ════════════════════════════ Colophon ═══════════════════════════════════ */
.ps-colo {
  flex-direction: row;
  align-items: center;
  gap: 54px;
  padding-right: 80px;
}
.ps-colo-stats {
  display: grid;
  grid-template-columns: repeat(2, auto);
  gap: 22px 40px;
}
.ps-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.ps-stat-v {
  font-family: var(--font-brush);
  font-size: 44px;
  line-height: 1;
  color: var(--ps-ink);
  font-variant-numeric: tabular-nums;
}
.ps-stat-k {
  margin-top: 4px;
  font-family: var(--font-ink-serif);
  font-size: 11.5px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--ps-ink-soft);
}
.ps-colo-end {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}
.ps-colo-col {
  writing-mode: vertical-rl;
  font-family: var(--font-xing);
  font-size: 30px;
  letter-spacing: 0.2em;
  color: var(--ps-ink-mid);
}
.ps-colo-seal {
  width: 64px;
  mix-blend-mode: multiply;
  opacity: 0;
}
.ps-seen .ps-colo-seal {
  animation: ps-stamp 0.7s cubic-bezier(0.3, 1.25, 0.5, 1) 0.9s forwards;
}

/* ════════════════════════════ Travel / roll-up ═══════════════════════════ */
.ps-nav-f-enter-active,
.ps-nav-b-enter-active {
  transition:
    opacity 0.7s ease 0.12s,
    transform 0.8s var(--ps-soft) 0.12s,
    filter 0.7s ease 0.12s;
}
.ps-nav-f-leave-active,
.ps-nav-b-leave-active {
  transition:
    opacity 0.45s ease,
    transform 0.55s var(--ps-ease),
    filter 0.45s ease;
}
.ps-nav-f-enter-from {
  opacity: 0;
  transform: translateX(90px);
  filter: blur(6px);
}
.ps-nav-f-leave-to {
  opacity: 0;
  transform: translateX(-90px);
  filter: blur(8px) grayscale(1);
}
.ps-nav-b-enter-from {
  opacity: 0;
  transform: translateX(-90px);
  filter: blur(6px);
}
.ps-nav-b-leave-to {
  opacity: 0;
  transform: translateX(90px);
  filter: blur(8px) grayscale(1);
}

/* Closing (PersonModal's 'pvs' leave) or swapping away (its 'pv-swap'
   leave): the paper rolls back up onto the rollers. */
.pvs-leave-active .ps-paper,
.ps.pv-swap-leave-active .ps-paper {
  animation: ps-rollup 0.7s var(--ps-ease) both;
}
.pvs-leave-active .ps-roller,
.ps.pv-swap-leave-active .ps-roller {
  animation: ps-roller-out 0.7s var(--ps-ease) both;
}
.pvs-leave-active .ps-track,
.ps.pv-swap-leave-active .ps-track {
  transition: opacity 0.25s ease;
  opacity: 0;
}
.ps.pv-swap-leave-active,
.pvs-leave-active .ps {
  animation: ps-fade-out 0.85s ease both;
}
@keyframes ps-rollup {
  from {
    clip-path: inset(0 0 0 0);
  }
  to {
    clip-path: inset(0 calc(50% - 4px) 0 calc(50% - 4px));
  }
}
@keyframes ps-roller-out {
  to {
    transform: translateX(var(--from));
  }
}
@keyframes ps-fade-out {
  0%,
  78% {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}
@keyframes ps-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* ════════════════════════════ Hanging scroll (phones) ════════════════════ */
.ps-vert .ps-scroll {
  top: 58px;
  bottom: 12px;
  left: 12px;
  right: 12px;
}
.ps-vert .ps-roller {
  top: auto;
  bottom: auto;
  left: -10px;
  right: -10px;
  width: auto;
  height: 22px;
  flex-direction: row;
  animation-name: ps-roller-in-v;
}
.ps-vert .ps-roller-a {
  top: 0;
  --from: calc(50cqh - 22px);
}
.ps-vert .ps-roller-b {
  top: auto;
  bottom: 0;
  --from: calc(22px - 50cqh);
}
@keyframes ps-roller-in-v {
  0% {
    opacity: 0;
    transform: translateY(var(--from)) scale(0.96);
  }
  14% {
    opacity: 1;
    transform: translateY(var(--from));
  }
  24% {
    transform: translateY(var(--from));
  }
  to {
    transform: none;
  }
}
.ps-vert .ps-rod {
  width: auto;
  height: 100%;
  background:
    linear-gradient(
      180deg,
      rgba(0, 0, 0, 0.45),
      rgba(255, 230, 190, 0.22) 32%,
      rgba(255, 240, 210, 0.08) 45%,
      rgba(0, 0, 0, 0.2) 70%,
      rgba(0, 0, 0, 0.55)
    ),
    repeating-linear-gradient(
      180deg,
      transparent 0 5px,
      rgba(0, 0, 0, 0.14) 5px 6px,
      transparent 6px 11px
    ),
    color-mix(in srgb, var(--ps-ochre) 38%, var(--ps-ink));
  background-position:
    0 0,
    0 calc(var(--ps-roll) * -0.6),
    0 0;
}
.ps-vert .ps-knob {
  width: 14px;
  height: calc(100% + 8px);
}
.ps-vert .ps-knob-1 {
  margin: 0 -3px 0 0;
}
.ps-vert .ps-knob-2 {
  margin: 0 0 0 -3px;
}
.ps-vert .ps-paper {
  left: 0;
  right: 0;
  top: 16px;
  bottom: 16px;
  animation-name: ps-unroll-v;
}
@keyframes ps-unroll-v {
  0%,
  24% {
    clip-path: inset(calc(50% - 4px) 0 calc(50% - 4px) 0);
  }
  to {
    clip-path: inset(0 0 0 0);
  }
}
.ps-vert .ps-paper::before {
  inset: 0 0 auto 0;
  width: auto;
  height: 30px;
  background: linear-gradient(180deg, rgba(60, 40, 15, 0.24), transparent);
}
.ps-vert .ps-paper::after {
  inset: auto 0 0 0;
  width: auto;
  height: 30px;
  background: linear-gradient(0deg, rgba(60, 40, 15, 0.24), transparent);
}
.ps-vert .ps-silk {
  display: none;
}
.ps-vert .ps-land-wrap {
  top: 0;
  bottom: auto;
  width: 100%;
  height: 46%;
  transform: translateY(calc(var(--ps-p) * -18%));
}
.ps-vert .ps-mist-a {
  top: 26%;
}
.ps-vert .ps-mist-b {
  top: 40%;
}
.ps-vert .ps-track {
  top: 0;
  bottom: 0;
  overflow-x: hidden;
  overflow-y: auto;
}
.ps-vert .ps-leaves {
  flex-direction: column;
  width: 100%;
  height: auto;
  padding: 0 0 40px;
}
.ps-vert .ps-leaf {
  height: auto;
  padding: 34px 22px 30px;
}
.ps-vert .ps-leaf + .ps-leaf::before {
  left: 10%;
  right: 10%;
  top: 0;
  bottom: auto;
  width: auto;
  height: 10px;
  -webkit-mask-image: var(--ps-hst);
  mask-image: var(--ps-hst);
}
.ps-vert .ps-leaf-c::after {
  inset: 0 -6% 0 -6%;
}
.ps-vert .ps-hero {
  flex-direction: column;
  min-width: 0;
  min-height: 82cqh;
  justify-content: center;
  gap: 22px;
  padding-top: 40px;
}
.ps-vert .ps-portrait {
  --psz: min(64cqw, 34cqh, 300px);
}
.ps-vert .ps-ident {
  align-items: center;
  text-align: center;
}
.ps-vert .ps-name {
  align-items: center;
  font-size: clamp(40px, 12cqw, 64px);
}
.ps-vert .ps-name-v {
  font-size: clamp(44px, 14cqw, 72px);
}
.ps-vert .ps-name-row,
.ps-vert .ps-dates,
.ps-vert .ps-facts,
.ps-vert .ps-slips {
  justify-content: center;
}
.ps-vert .ps-inscr {
  margin: 0;
}
.ps-vert .ps-hint {
  position: static;
  margin-top: 6px;
}
.ps-vert .ps-hint-arrow {
  width: 9px;
  height: 34px;
  -webkit-mask-image: var(--ps-vdiv);
  mask-image: var(--ps-vdiv);
}
.ps-vert .ps-cols {
  flex-direction: column;
  gap: 0;
}
.ps-vert .ps-col,
.ps-vert .ps-col-text,
.ps-vert .ps-col-traits,
.ps-vert .ps-col-chron,
.ps-vert .ps-col:has(.ps-bond) {
  width: auto;
  overflow: visible;
}
.ps-vert .ps-leaf-kin {
  width: auto;
}
.ps-vert .ps-kin-body {
  overflow: visible;
  overflow-x: auto;
}
.ps-vert .ps-leaf {
  min-width: 0;
  max-width: 100%;
}
.ps-vert .ps-lh {
  flex-wrap: wrap;
  height: auto;
  min-height: 52px;
}
.ps-vert .ps-sketch-box {
  justify-content: flex-start;
  overflow-x: auto;
}
.ps-vert .ps-gallery {
  flex-wrap: wrap;
  justify-content: center;
}
.ps-vert .ps-mount {
  height: 260px;
}
.ps-vert .ps-blank {
  width: auto;
}
.ps-vert .ps-colo {
  flex-direction: column;
  padding-right: 22px;
}
.ps-vert .pvs-leave-active .ps-paper,
.pvs-leave-active .ps-vert .ps-paper,
.ps-vert.pv-swap-leave-active .ps-paper {
  animation-name: ps-rollup-v;
}
.pvs-leave-active .ps-vert .ps-roller,
.ps-vert.pv-swap-leave-active .ps-roller {
  animation-name: ps-roller-out-v;
}
@keyframes ps-rollup-v {
  to {
    clip-path: inset(calc(50% - 4px) 0 calc(50% - 4px) 0);
  }
}
@keyframes ps-roller-out-v {
  to {
    transform: translateY(var(--from));
  }
}

/* ════════════════════════════ Reduced motion ═════════════════════════════ */
.ps-rm *,
.ps-rm *::before,
.ps-rm *::after,
.ps-rm.ps,
.ps-rm .ps-paper,
.ps-rm .ps-roller {
  animation-duration: 0.01ms !important;
  animation-delay: 0s !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
}
.ps-rm .ps-mist {
  animation: none !important;
}
</style>
