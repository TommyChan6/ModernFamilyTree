<template>
  <Transition name="pv">
    <div
      v-if="store.modalOpen && person"
      class="pv-overlay"
      :style="accentVars"
      @pointermove="onOverlayMove"
    >
      <!-- ── Ambient background: blurred portrait, aurora, giant monogram ── -->
      <div class="pv-bg" aria-hidden="true">
        <div
          v-if="portraitUrl"
          class="pv-bg-photo"
          :style="{ backgroundImage: `url('${portraitUrl}')` }"
        ></div>
        <div class="pv-aurora pv-aurora-a"></div>
        <div class="pv-aurora pv-aurora-b"></div>
        <div class="pv-aurora pv-aurora-c"></div>
        <div class="pv-bg-word">{{ initialsOf(person.name) }}</div>
        <div class="pv-vignette"></div>
      </div>

      <!-- Cursor-following light -->
      <div ref="spotEl" class="pv-spotlight" aria-hidden="true"></div>

      <!-- ── Chrome ── -->
      <header class="pv-chrome">
        <button class="pv-back" @click="goBack">
          <span class="pv-back-arrow">←</span>
          <span class="pv-back-label">{{ backLabel }}</span>
          <kbd class="pv-kbd">Esc</kbd>
        </button>
        <div class="pv-chrome-spacer"></div>
        <button class="pv-act" @click="store.openForm(person)"><span>✎</span> Edit</button>
        <button class="pv-act pv-act-danger" @click="handleDelete"><span>🗑</span> Delete</button>
        <button class="pv-x" title="Close profile" @click="store.closeModal()">✕</button>
      </header>

      <!-- ── Person content (keyed → animated person-to-person travel) ── -->
      <div class="pv-stage">
        <Transition :name="navDir < 0 ? 'pv-nav-b' : 'pv-nav-f'">
          <main :key="person.id" class="pv-main">
            <!-- Identity column -->
            <aside class="pv-identity">
              <div
                ref="cardEl"
                class="pv-card"
                :class="{ 'pv-card-tilting': tilt.on, 'pv-card-dead': deceased }"
                :style="cardStyle"
                @pointermove="onCardMove"
                @pointerleave="onCardLeave"
                @click="portraitIndex >= 0 && (lightbox = portraitIndex)"
              >
                <div class="pv-card-float">
                  <div class="pv-card-inner">
                    <img
                      v-if="portraitUrl"
                      class="pv-card-img"
                      :src="portraitUrl"
                      alt=""
                      draggable="false"
                      decoding="async"
                    />
                    <div v-else class="pv-monogram">
                      <div class="pv-monogram-halo"></div>
                      <span class="pv-monogram-text">{{ initialsOf(person.name) }}</span>
                    </div>
                    <div class="pv-card-glare"></div>
                    <div class="pv-card-rim"></div>
                    <div v-if="deceased" class="pv-memoriam">🕊 In memoriam</div>
                  </div>
                </div>
              </div>

              <h1 class="pv-name">
                <span
                  v-for="(ch, i) in nameChars"
                  :key="i + '-' + ch"
                  class="pv-ch"
                  :style="{ '--d': Math.min(i, 24) * 0.032 + 's' }"
                  >{{ ch }}</span
                >
              </h1>
              <div class="pv-name-rule"></div>

              <div class="pv-lifespan">
                <template v-if="person.birth?.year || person.death?.year">
                  <span class="pv-year">{{ fmtDate(person.birth) || '?' }}</span>
                  <span class="pv-life-line">
                    <span class="pv-life-dot" :class="{ 'pv-alive': !deceased }"></span>
                  </span>
                  <span class="pv-year">{{
                    deceased ? fmtDate(person.death) || '?' : 'present'
                  }}</span>
                  <span v-if="age !== null" class="pv-age">{{ age }} yrs</span>
                </template>
                <span v-else class="pv-dim">No dates recorded</span>
              </div>

              <div class="pv-chips">
                <span v-if="person.gender && person.gender !== 'unknown'" class="pv-chip">
                  {{ genderGlyph }} {{ person.gender }}
                </span>
                <span v-if="person.occupation" class="pv-chip">💼 {{ person.occupation }}</span>
                <span v-if="person.location" class="pv-chip">📍 {{ person.location }}</span>
              </div>

              <div v-if="personTags.length" class="pv-tags">
                <span
                  v-for="tag in personTags"
                  :key="tag.id"
                  class="pv-tag"
                  :style="{ '--tc': tag.color || 'var(--pa)' }"
                >
                  <span class="pv-tag-dot"></span>{{ tag.icon ? tag.icon + ' ' : ''
                  }}{{ tag.label }}
                </span>
              </div>

              <div class="pv-stats">
                <div class="pv-stat" style="--i: 0">
                  <span class="pv-stat-val">{{ statsShown.bonds }}</span>
                  <span class="pv-stat-key">Bonds</span>
                </div>
                <div class="pv-stat" style="--i: 1">
                  <span class="pv-stat-val">{{ statsShown.circle }}</span>
                  <span class="pv-stat-key">Circle</span>
                </div>
                <div class="pv-stat" style="--i: 2">
                  <span class="pv-stat-val">{{ statsShown.traits }}</span>
                  <span class="pv-stat-key">Traits</span>
                </div>
                <div class="pv-stat" style="--i: 3">
                  <span class="pv-stat-val">{{ statsShown.photos }}</span>
                  <span class="pv-stat-key">Photos</span>
                </div>
              </div>
            </aside>

            <!-- Detail column -->
            <section class="pv-content">
              <!-- Constellation -->
              <section v-if="ring1.length" class="pv-section" style="--i: 0">
                <h2 class="pv-h">
                  Constellation
                  <span class="pv-h-sub">{{ circleCount }} within two bonds</span>
                </h2>
                <div class="pv-orbit" :class="{ 'pv-orbit-lg': ring2.length }">
                  <div v-if="ring2.length" class="pv-ring pv-ring-2"></div>
                  <div class="pv-ring pv-ring-1"></div>

                  <div class="pv-orbit-center">
                    <div class="pv-orbit-halo"></div>
                    <div class="pv-orbit-me">
                      <img v-if="portraitUrl" :src="portraitUrl" alt="" draggable="false" />
                      <span v-else>{{ initialsOf(person.name) }}</span>
                    </div>
                  </div>

                  <div class="pv-spinner pv-spin-1">
                    <button
                      v-for="(sat, i) in ring1"
                      :key="sat.otherId"
                      class="pv-sat pv-sat-1"
                      :class="{ 'pv-sat-ended': sat.ended }"
                      :style="satStyle(i, ring1.length, ring2.length ? 132 : 118)"
                      :title="sat.roles + ' — ' + sat.name"
                      @click="navigateTo(sat.otherId)"
                    >
                      <span class="pv-sat-inner pv-counter-1">
                        <span class="pv-sat-avatar">
                          <img v-if="sat.img" :src="imageUrl(sat.img)" alt="" draggable="false" />
                          <span v-else>{{ initialsOf(sat.name) }}</span>
                        </span>
                        <span class="pv-sat-label">
                          <b>{{ sat.roles }}</b
                          >{{ sat.name }}
                        </span>
                      </span>
                    </button>
                  </div>

                  <div v-if="ring2.length" class="pv-spinner pv-spin-2">
                    <button
                      v-for="(sat, i) in ring2"
                      :key="sat.otherId"
                      class="pv-sat pv-sat-2"
                      :style="satStyle(i, ring2.length, 208, 14)"
                      :title="sat.name"
                      @click="navigateTo(sat.otherId)"
                    >
                      <span class="pv-sat-inner pv-counter-2">
                        <span class="pv-sat-avatar">
                          <img v-if="sat.img" :src="imageUrl(sat.img)" alt="" draggable="false" />
                          <span v-else>{{ initialsOf(sat.name) }}</span>
                        </span>
                        <span class="pv-sat-label"><b>2 hops</b>{{ sat.name }}</span>
                      </span>
                    </button>
                  </div>
                </div>
              </section>

              <!-- Story -->
              <section v-if="person.bio" class="pv-section" style="--i: 1">
                <h2 class="pv-h">Story</h2>
                <p class="pv-bio" :class="{ 'pv-bio-cap': person.bio.length > 140 }">
                  {{ person.bio }}
                </p>
              </section>

              <!-- Traits -->
              <section v-if="traitRows.length" class="pv-section" style="--i: 2">
                <h2 class="pv-h">
                  Traits <span class="pv-h-sub">{{ traitRows.length }}</span>
                </h2>
                <div class="pv-traits">
                  <div
                    v-for="(t, i) in traitRows"
                    :key="t.id"
                    class="pv-trait"
                    :class="{ 'pv-trait-wide': t.kind === 'para' }"
                    :style="{ '--i': i }"
                  >
                    <div class="pv-trait-head">
                      <span v-if="t.icon" class="pv-trait-icon">{{ t.icon }}</span>
                      {{ t.label }}
                    </div>
                    <div v-if="t.kind === 'slider'" class="pv-trait-slider">
                      <div class="pv-bar">
                        <div class="pv-bar-fill" :style="{ width: t.pct + '%' }"></div>
                        <div class="pv-bar-spark" :style="{ left: t.pct + '%' }"></div>
                      </div>
                      <div v-if="t.left || t.right" class="pv-bar-labels">
                        <span>{{ t.left }}</span>
                        <span>{{ t.right }}</span>
                      </div>
                    </div>
                    <div v-else-if="t.kind === 'select'" class="pv-trait-value">
                      <span
                        v-if="t.color"
                        class="pv-select-dot"
                        :style="{ background: t.color }"
                      ></span>
                      {{ t.text }}
                    </div>
                    <div
                      v-else-if="t.kind === 'bool'"
                      class="pv-trait-value"
                      :class="t.bool ? 'pv-bool-yes' : 'pv-bool-no'"
                    >
                      {{ t.bool ? '✓ Yes' : '✕ No' }}
                    </div>
                    <div v-else-if="t.kind === 'para'" class="pv-trait-para">{{ t.text }}</div>
                    <div v-else class="pv-trait-value">{{ t.text }}</div>
                  </div>
                </div>
              </section>

              <!-- Chronicle -->
              <section v-if="lifeEvents.length" class="pv-section" style="--i: 3">
                <h2 class="pv-h">Chronicle</h2>
                <div class="pv-chron">
                  <div
                    v-for="(ev, i) in lifeEvents"
                    :key="i"
                    class="pv-ev"
                    :class="{ 'pv-ev-link': !!ev.personId }"
                    :style="{ '--i': i }"
                    @click="ev.personId && navigateTo(ev.personId)"
                  >
                    <div class="pv-ev-year">{{ ev.when }}</div>
                    <div class="pv-ev-node">
                      <span class="pv-ev-dot" :class="'pv-ev-' + ev.kind"></span>
                    </div>
                    <div class="pv-ev-body">
                      <span v-if="ev.glyph" class="pv-ev-glyph">{{ ev.glyph }}</span>
                      <span class="pv-ev-title">{{ ev.title }}</span>
                      <span v-if="ev.sub" class="pv-ev-sub">{{ ev.sub }}</span>
                    </div>
                  </div>
                </div>
              </section>

              <!-- Bonds -->
              <section v-if="bondGroups.length" class="pv-section" style="--i: 4">
                <h2 class="pv-h">
                  Bonds <span class="pv-h-sub">{{ relationshipChips.length }}</span>
                </h2>
                <div v-for="g in bondGroups" :key="g.key" class="pv-band">
                  <div class="pv-band-name">{{ g.label }}</div>
                  <div class="pv-band-chips">
                    <button
                      v-for="(c, i) in g.chips"
                      :key="c.id"
                      class="pv-bond"
                      :class="{ 'pv-bond-ended': c.ended }"
                      :style="{ '--bc': c.color, '--i': i }"
                      @click="navigateTo(c.otherId)"
                    >
                      <span class="pv-bond-avatar">
                        <img v-if="c.img" :src="imageUrl(c.img)" alt="" draggable="false" />
                        <span v-else>{{ initialsOf(c.name) }}</span>
                      </span>
                      <span class="pv-bond-text">
                        <span class="pv-bond-role">{{ c.glyph }} {{ c.role }}</span>
                        <span class="pv-bond-name">{{ c.name }}</span>
                      </span>
                      <span v-if="c.endedYear" class="pv-bond-endtag">ended {{ c.endedYear }}</span>
                    </button>
                  </div>
                </div>
              </section>

              <!-- Gallery -->
              <section v-if="images.length" class="pv-section" style="--i: 5">
                <h2 class="pv-h">
                  Gallery <span class="pv-h-sub">{{ images.length }}</span>
                </h2>
                <div class="pv-gallery">
                  <button
                    v-for="(img, i) in images"
                    :key="img.id"
                    class="pv-photo"
                    :style="{ '--i': i }"
                    @click="lightbox = i"
                  >
                    <img :src="imageUrl(img.file_path)" alt="" loading="lazy" decoding="async" />
                    <span v-if="img.role" class="pv-photo-role">{{ img.role }}</span>
                    <span v-if="img.is_primary" class="pv-photo-star">★</span>
                  </button>
                </div>
              </section>

              <!-- Blank slate -->
              <section v-if="isBlank" class="pv-section pv-empty" style="--i: 0">
                <div class="pv-empty-mark">✦</div>
                <div class="pv-empty-title">A story waiting to be written</div>
                <div class="pv-empty-text">
                  No traits, bonds, or photos yet — open the editor to bring
                  {{ person.name || 'them' }} to life.
                </div>
                <button class="pv-act pv-empty-cta" @click="store.openForm(person)">
                  ✎ Start editing
                </button>
              </section>

              <div class="pv-content-tail"></div>
            </section>
          </main>
        </Transition>
      </div>

      <!-- ── Lightbox ── -->
      <Transition name="pv-lb">
        <div
          v-if="lightbox !== null && images[lightbox]"
          class="pv-lightbox"
          @click.self="lightbox = null"
        >
          <button v-if="images.length > 1" class="pv-lb-nav pv-lb-prev" @click="stepLightbox(-1)">
            ‹
          </button>
          <div class="pv-lb-frame">
            <img :key="images[lightbox].id" :src="imageUrl(images[lightbox].file_path)" alt="" />
            <div class="pv-lb-caption">
              {{ person.name }}
              <span v-if="images[lightbox].role" class="pv-lb-role">{{
                images[lightbox].role
              }}</span>
              <span class="pv-lb-count">{{ lightbox + 1 }} / {{ images.length }}</span>
            </div>
          </div>
          <button v-if="images.length > 1" class="pv-lb-nav pv-lb-next" @click="stepLightbox(1)">
            ›
          </button>
          <button class="pv-lb-x" @click="lightbox = null">✕</button>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { useMainStore } from '../store/index.js'
import { api } from '../api'
import { derivedSiblings, egoDistances } from './graph/graphInsights.js'
import { ageOf } from './people/peopleLayout.js'

// The full-canvas person profile: takes over the whole workspace like a view
// of its own (Esc / ← steps back through visited people, then closes back to
// whatever view was open). Everything animated runs on transform/opacity so
// the page stays smooth; the graph underneath idles at 0% CPU meanwhile.

const store = useMainStore()

const person = computed(() => store.selectedPerson)
const images = ref([])
const lightbox = ref(null)

const reduceMotion =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ── Helpers ─────────────────────────────────────────────────────────────────
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fmtDate(dv) {
  if (!dv || dv.year == null) return ''
  const m = dv.month
  if (dv.precision === 'day' && m && dv.day) return `${dv.day} ${MONTHS[m - 1]} ${dv.year}`
  if ((dv.precision === 'day' || dv.precision === 'month') && m)
    return `${MONTHS[m - 1]} ${dv.year}`
  return String(dv.year)
}

function dateOrd(dv) {
  if (!dv || dv.year == null) return null
  return dv.year + ((dv.month || 1) - 1) / 12 + ((dv.day || 1) - 1) / 372
}

function initialsOf(name) {
  const parts = (name || '?').trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (parts[0] || '?').substring(0, 2).toUpperCase()
}

function imageUrl(filePath) {
  return api.getImageUrl(filePath) || ''
}

function hexMix(a, b, t) {
  const pa = parseInt(a.slice(1), 16)
  const pb = parseInt(b.slice(1), 16)
  const ch = (sh) => Math.round(((pa >> sh) & 255) + (((pb >> sh) & 255) - ((pa >> sh) & 255)) * t)
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`
}

// ── Identity ────────────────────────────────────────────────────────────────
const refYear = computed(() => store.currentDate?.year ?? new Date().getFullYear())
const deceased = computed(() => person.value?.death?.year != null)
const age = computed(() => (person.value ? ageOf(person.value, refYear.value) : null))
// Spaces become NBSP so the per-letter inline-block spans keep word gaps.
const nameChars = computed(() =>
  (person.value?.name || 'Unnamed').split('').map((ch) => (ch === ' ' ? ' ' : ch))
)
const genderGlyph = computed(() =>
  person.value?.gender === 'male' ? '♂' : person.value?.gender === 'female' ? '♀' : '⚧'
)

// The profile's signature color: the same male↔female gradient position the
// graph uses for node tinting, falling back to the unknown color.
const personAccent = computed(() => {
  const g = store.graphSettings
  const t = person.value?.gender_t
  if (t == null) return g.unknownColor || '#5c6bc0'
  return hexMix(g.maleColor || '#3a7bd5', g.femaleColor || '#c95fa0', t)
})
const accentVars = computed(() => ({ '--pa': personAccent.value }))

const personTags = computed(() => (person.value ? store.tagsOf.get(person.value.id) || [] : []))

// ── Portrait & gallery ──────────────────────────────────────────────────────
const portraitIndex = computed(() => {
  if (!images.value.length) return -1
  const byRole = images.value.findIndex((i) => i.role === 'portrait')
  if (byRole !== -1) return byRole
  const primary = images.value.findIndex((i) => i.is_primary)
  return primary !== -1 ? primary : 0
})
const portraitPath = computed(
  () => images.value[portraitIndex.value]?.file_path || person.value?.primary_image || null
)
const portraitUrl = computed(() => (portraitPath.value ? imageUrl(portraitPath.value) : ''))

let imagesToken = 0
watch(
  () => (store.modalOpen ? person.value?.id : null),
  async (pid) => {
    lightbox.value = null
    if (!pid) return
    images.value = []
    const mine = ++imagesToken
    const res = await api.invoke('images:getByPerson', { personId: pid })
    if (mine !== imagesToken) return
    images.value = res.success ? res.data : []
  },
  { immediate: true }
)

function stepLightbox(dir) {
  if (lightbox.value === null || !images.value.length) return
  lightbox.value = (lightbox.value + dir + images.value.length) % images.value.length
}

// ── Relationship chips (roles, colors, bands) ───────────────────────────────
const personById = computed(() => new Map(store.persons.map((p) => [p.id, p])))

const relationshipChips = computed(() => {
  const p = person.value
  if (!p) return []
  const pid = p.id
  const g = store.graphSettings
  const chips = []

  const legacyColor = {
    parent_child: g.parentChildColor,
    spouse: g.spouseColor,
    adopted: g.adoptedColor
  }

  store.relationships.forEach((r) => {
    if (r.person_a_id !== pid && r.person_b_id !== pid) return
    const otherId = r.person_a_id === pid ? r.person_b_id : r.person_a_id
    const other = personById.value.get(otherId)
    if (!other) return

    const def = store.relTypeByKey.get(r.type)
    let role = ''
    if (r.type === 'spouse') {
      role = other.gender === 'male' ? 'Husband' : other.gender === 'female' ? 'Wife' : 'Spouse'
    } else if (r.type === 'parent_child') {
      role =
        r.person_a_id === pid
          ? other.gender === 'male'
            ? 'Son'
            : other.gender === 'female'
              ? 'Daughter'
              : 'Child'
          : other.gender === 'male'
            ? 'Father'
            : other.gender === 'female'
              ? 'Mother'
              : 'Parent'
    } else if (r.type === 'adopted') {
      role = r.person_a_id === pid ? 'Adopted child' : 'Adoptive parent'
    } else if (def?.directed) {
      role = (r.person_a_id === pid ? def.role_b : def.role_a) || def.label
    } else {
      role = r.label || def?.label || r.type
    }

    chips.push({
      id: r.id,
      otherId,
      name: other.name || 'Unnamed',
      img: other.primary_image || null,
      role,
      glyph: def?.glyph || '∙',
      band: def?.band || 'custom',
      color: def?.color || legacyColor[r.type] || personAccent.value,
      formed: r.formed,
      ended: !!r.ended?.year,
      endedYear: r.ended?.year ?? null,
      isParentOfOther:
        r.type !== 'spouse' && def?.symmetryRole === 'vertical' && r.person_a_id === pid,
      type: r.type
    })
  })

  // Derived siblings (shared vertical-edge parents), unless an explicit row
  // to the same person already says so.
  const explicit = new Set(chips.map((c) => c.otherId + '~' + c.role))
  const sibDef = store.relTypeByKey.get('sibling')
  const sibs = derivedSiblings(
    store.relationships,
    store.relTypeRoles.size ? (t) => store.relTypeRoles.get(t) || 'none' : undefined
  )
  for (const otherId of sibs.get(pid) || []) {
    const other = personById.value.get(otherId)
    if (!other) continue
    const role =
      other.gender === 'male' ? 'Brother' : other.gender === 'female' ? 'Sister' : 'Sibling'
    if (explicit.has(otherId + '~' + role)) continue
    chips.push({
      id: 'sib:' + otherId,
      otherId,
      name: other.name || 'Unnamed',
      img: other.primary_image || null,
      role,
      glyph: sibDef?.glyph || '⁘',
      band: 'family',
      color: sibDef?.color || personAccent.value,
      formed: null,
      ended: false,
      endedYear: null,
      type: 'sibling'
    })
  }

  return chips
})

const BAND_LABELS = { family: 'Family', social: 'Social', power: 'Power', custom: 'Other' }
const bondGroups = computed(() => {
  const order = ['family', 'social', 'power', 'custom']
  const byBand = new Map()
  for (const c of relationshipChips.value) {
    const key = order.includes(c.band) ? c.band : 'custom'
    if (!byBand.has(key)) byBand.set(key, [])
    byBand.get(key).push(c)
  }
  return order
    .filter((k) => byBand.has(k))
    .map((k) => ({ key: k, label: BAND_LABELS[k], chips: byBand.get(k) }))
})

// ── Constellation rings ─────────────────────────────────────────────────────
const RING1_CAP = 12
const RING2_CAP = 16

const ring1 = computed(() => {
  const seen = new Map()
  for (const c of relationshipChips.value) {
    const cur = seen.get(c.otherId)
    if (cur) {
      if (!cur.roles.includes(c.role)) cur.roles += ' · ' + c.role
      cur.ended = cur.ended && c.ended
    } else {
      seen.set(c.otherId, {
        otherId: c.otherId,
        name: c.name,
        img: c.img,
        roles: c.role,
        ended: c.ended
      })
    }
  }
  return [...seen.values()].slice(0, RING1_CAP)
})

const egoMap = computed(() =>
  person.value ? egoDistances(person.value.id, store.relationships, 2) : new Map()
)
const circleCount = computed(() => Math.max(0, egoMap.value.size - 1))

const ring2 = computed(() => {
  const out = []
  for (const [id, d] of egoMap.value) {
    if (d !== 2) continue
    const p = personById.value.get(id)
    if (!p) continue
    out.push({ otherId: id, name: p.name || 'Unnamed', img: p.primary_image || null })
    if (out.length >= RING2_CAP) break
  }
  return out
})

function satStyle(i, n, radius, offsetDeg = 0) {
  const angle = (360 / n) * i - 90 + offsetDeg
  return {
    transform: `rotate(${angle}deg) translate(${radius}px) rotate(${-angle}deg)`,
    '--i': i
  }
}

// ── Traits ──────────────────────────────────────────────────────────────────
const traitRows = computed(() => {
  const p = person.value
  if (!p) return []
  const vals = store.fieldValuesOf.get(p.id)
  if (!vals) return []
  const rows = []
  for (const def of store.fieldDefs) {
    if (['name', 'birth', 'death', 'gender'].includes(def.slot)) continue
    // The identity column already owns these (Story section, fact chips).
    if (['bio', 'occupation', 'location'].includes(def.sys)) continue
    const row = vals.get(def.id)
    if (!row || row.value == null || row.value === '') continue
    const v = row.value
    const t = { id: def.id, label: def.label, icon: def.icon, kind: 'text', text: '' }
    switch (def.type) {
      case 'slider': {
        const cfg = def.config || {}
        const min = cfg.min ?? 0
        const max = cfg.max ?? 100
        const num = Number(v)
        if (!Number.isFinite(num)) continue
        t.kind = 'slider'
        t.pct = Math.max(0, Math.min(100, ((num - min) / (max - min || 1)) * 100))
        t.left = cfg.leftLabel || ''
        t.right = cfg.rightLabel || ''
        break
      }
      case 'select': {
        const opt = (def.config?.options || []).find((o) => o.id === v)
        t.kind = 'select'
        t.text = opt?.label ?? String(v)
        t.color = opt?.color || ''
        break
      }
      case 'boolean':
        t.kind = 'bool'
        t.bool = !!v
        break
      case 'number':
        t.text = `${v}${def.unit ? ' ' + def.unit : ''}`
        break
      case 'number_range':
        t.text =
          v && typeof v === 'object'
            ? `${v.a ?? '?'} – ${v.b ?? '?'}${def.unit ? ' ' + def.unit : ''}`
            : String(v)
        break
      case 'date':
        t.text = fmtDate(v)
        break
      case 'date_range':
        t.text = `${fmtDate(v?.from) || '?'} – ${fmtDate(v?.to) || '?'}`
        break
      default:
        t.kind = def.config?.multiline ? 'para' : 'text'
        t.text = String(v)
    }
    if (t.kind !== 'slider' && t.kind !== 'bool' && !t.text) continue
    rows.push(t)
  }
  return rows
})

// ── Chronicle (life events) ─────────────────────────────────────────────────
const lifeEvents = computed(() => {
  const p = person.value
  if (!p) return []
  const evs = []
  const push = (dv, ev) => {
    const ord = dateOrd(dv)
    if (ord == null) return
    evs.push({ ord, when: fmtDate(dv), ...ev })
  }

  push(p.birth, { title: 'Born', sub: p.location || '', kind: 'birth', glyph: '☀' })

  for (const c of relationshipChips.value) {
    if (c.type === 'spouse') {
      push(c.formed, {
        title: `Married ${c.name}`,
        sub: '',
        kind: 'union',
        glyph: c.glyph,
        personId: c.otherId
      })
    } else if (c.isParentOfOther) {
      // Children arrive on their own birth dates — the richest chronicle rows.
      const child = personById.value.get(c.otherId)
      push(child?.birth, {
        title: `${c.name} born`,
        sub: c.role,
        kind: 'child',
        glyph: '✧',
        personId: c.otherId
      })
    } else {
      push(c.formed, {
        title: `${c.role} — ${c.name}`,
        sub: '',
        kind: 'bond',
        glyph: c.glyph,
        personId: c.otherId
      })
    }
    if (c.ended && c.endedYear) {
      push(
        { year: c.endedYear, month: null, day: null, precision: 'year' },
        {
          title: `${c.role} ended — ${c.name}`,
          sub: '',
          kind: 'ended',
          glyph: '⌁',
          personId: c.otherId
        }
      )
    }
  }

  if (deceased.value) {
    const at = ageOf(p, p.death.year)
    push(p.death, {
      title: 'Died',
      sub: at != null ? `at ${at}` : '',
      kind: 'death',
      glyph: '☾'
    })
  }

  evs.sort((a, b) => a.ord - b.ord)
  return evs.slice(0, 40)
})

const isBlank = computed(
  () =>
    !person.value?.bio &&
    !traitRows.value.length &&
    !relationshipChips.value.length &&
    !images.value.length &&
    !lifeEvents.value.length
)

// ── Animated stat counters ──────────────────────────────────────────────────
const statsShown = reactive({ bonds: 0, circle: 0, traits: 0, photos: 0 })
const statTargets = computed(() => ({
  bonds: relationshipChips.value.length,
  circle: circleCount.value,
  traits: traitRows.value.length,
  photos: images.value.length
}))
let statRaf = 0
watch(
  [statTargets, () => store.modalOpen],
  ([to, open]) => {
    cancelAnimationFrame(statRaf)
    if (!open) return
    if (reduceMotion) {
      Object.assign(statsShown, to)
      return
    }
    const from = { ...statsShown }
    const t0 = performance.now()
    const D = 750
    const step = (now) => {
      const k = Math.min(1, (now - t0) / D)
      const e = 1 - Math.pow(1 - k, 3)
      for (const key of Object.keys(to)) {
        statsShown[key] = Math.round(from[key] + (to[key] - from[key]) * e)
      }
      if (k < 1) statRaf = requestAnimationFrame(step)
    }
    statRaf = requestAnimationFrame(step)
  },
  { immediate: true }
)

// ── 3D tilt card ────────────────────────────────────────────────────────────
const cardEl = ref(null)
const tilt = reactive({ rx: 0, ry: 0, mx: 50, my: 40, on: false })
let tiltRaf = 0
function onCardMove(e) {
  if (reduceMotion) return
  const el = cardEl.value
  if (!el || tiltRaf) return
  const x = e.clientX
  const y = e.clientY
  tiltRaf = requestAnimationFrame(() => {
    tiltRaf = 0
    const el2 = cardEl.value
    if (!el2) return
    const r = el2.getBoundingClientRect()
    if (!r.width || !r.height) return
    const px = (x - r.left) / r.width
    const py = (y - r.top) / r.height
    tilt.rx = (0.5 - py) * 13
    tilt.ry = (px - 0.5) * 13
    tilt.mx = px * 100
    tilt.my = py * 100
    tilt.on = true
  })
}
function onCardLeave() {
  tilt.rx = 0
  tilt.ry = 0
  tilt.on = false
}
const cardStyle = computed(() => ({
  '--rx': tilt.rx.toFixed(2) + 'deg',
  '--ry': tilt.ry.toFixed(2) + 'deg',
  '--mx': tilt.mx.toFixed(1) + '%',
  '--my': tilt.my.toFixed(1) + '%'
}))

// ── Cursor spotlight ────────────────────────────────────────────────────────
const spotEl = ref(null)
let spotRaf = 0
let spotX = 0
let spotY = 0
function onOverlayMove(e) {
  spotX = e.clientX
  spotY = e.clientY
  if (spotRaf) return
  spotRaf = requestAnimationFrame(() => {
    spotRaf = 0
    const el = spotEl.value
    // The overlay sits below the 48px topbar, so shift into overlay space.
    if (el) el.style.transform = `translate(${spotX}px, ${spotY - 48}px)`
  })
}

// ── Navigation: travel between people, step back, close ────────────────────
const navStack = ref([])
const navDir = ref(0)
let popping = false

function navigateTo(id) {
  if (!id || id === person.value?.id) return
  store.selectPerson(id)
}

function goBack() {
  while (navStack.value.length) {
    const prev = navStack.value.pop()
    if (store.persons.some((p) => p.id === prev)) {
      popping = true
      store.selectPerson(prev)
      return
    }
  }
  store.closeModal()
}

watch(
  () => store.selectedPersonId,
  (nid, oid) => {
    if (!store.modalOpen || !nid || nid === oid) return
    if (popping) {
      popping = false
      navDir.value = -1
    } else {
      if (oid) navStack.value.push(oid)
      navDir.value = 1
    }
  }
)

watch(
  () => store.modalOpen,
  (open) => {
    if (open) {
      navStack.value = []
      navDir.value = 0
      popping = false
    } else {
      lightbox.value = null
    }
  }
)

const VIEW_LABELS = {
  graph: 'Graph',
  directory: 'Directory',
  relationships: 'Relationships',
  timeline: 'Timeline',
  groups: 'Groups',
  character: 'Character'
}
const backLabel = computed(() => {
  const prevId = navStack.value[navStack.value.length - 1]
  const prev = prevId ? personById.value.get(prevId) : null
  if (prev) return prev.name || 'Back'
  return `Back to ${VIEW_LABELS[store.activeView] || 'view'}`
})

// ── Keyboard ────────────────────────────────────────────────────────────────
function onKeydown(e) {
  if (!store.modalOpen || !person.value) return
  // Yield to overlays stacked above the profile.
  if (store.formOpen || store.curtain.active || store.appSettingsOpen || store.userPageOpen) return
  if (e.key === 'Escape') {
    e.preventDefault()
    if (lightbox.value !== null) lightbox.value = null
    else goBack()
  } else if (lightbox.value !== null && e.key === 'ArrowRight') {
    e.preventDefault()
    stepLightbox(1)
  } else if (lightbox.value !== null && e.key === 'ArrowLeft') {
    e.preventDefault()
    stepLightbox(-1)
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  cancelAnimationFrame(statRaf)
  cancelAnimationFrame(tiltRaf)
  cancelAnimationFrame(spotRaf)
})

// ── Delete ──────────────────────────────────────────────────────────────────
async function handleDelete() {
  if (!person.value) return
  const name = person.value.name || 'this person'
  if (!confirm(`Delete ${name}? This cannot be undone.`)) return
  await store.deletePerson(person.value.id)
  store.closeModal()
}
</script>

<style scoped>
/* ════════════════════════════ Overlay shell ═══════════════════════════════ */
.pv-overlay {
  position: fixed;
  top: 48px; /* below the topbar — the app chrome stays reachable */
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg);
  isolation: isolate;
}

/* ═══════════════════════════ Ambient background ═══════════════════════════ */
.pv-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

/* Blurred portrait wash, slowly drifting (Ken Burns) */
.pv-bg-photo {
  position: absolute;
  inset: -12%;
  background-size: cover;
  background-position: center 30%;
  filter: blur(64px) saturate(1.35);
  opacity: 0.32;
  will-change: transform;
  animation: pv-kenburns 46s ease-in-out infinite alternate;
}
[data-theme='light'] .pv-bg-photo {
  opacity: 0.2;
}
@keyframes pv-kenburns {
  from {
    transform: scale(1) translate(0, 0);
  }
  to {
    transform: scale(1.14) translate(2.5%, -3%);
  }
}

/* Aurora blobs tinted by the person accent */
.pv-aurora {
  position: absolute;
  width: 46vw;
  height: 46vw;
  border-radius: 50%;
  filter: blur(90px);
  opacity: 0.16;
  will-change: transform;
}
[data-theme='light'] .pv-aurora {
  opacity: 0.11;
}
.pv-aurora-a {
  top: -18%;
  left: -8%;
  background: radial-gradient(circle, var(--pa), transparent 65%);
  animation: pv-drift-a 34s ease-in-out infinite alternate;
}
.pv-aurora-b {
  bottom: -24%;
  right: -6%;
  background: radial-gradient(circle, var(--accent), transparent 65%);
  animation: pv-drift-b 42s ease-in-out infinite alternate;
}
.pv-aurora-c {
  top: 30%;
  left: 46%;
  width: 30vw;
  height: 30vw;
  background: radial-gradient(circle, var(--pa), transparent 62%);
  opacity: 0.1;
  animation: pv-drift-c 52s ease-in-out infinite alternate;
}
@keyframes pv-drift-a {
  to {
    transform: translate(9vw, 7vh) scale(1.18);
  }
}
@keyframes pv-drift-b {
  to {
    transform: translate(-8vw, -6vh) scale(1.12);
  }
}
@keyframes pv-drift-c {
  to {
    transform: translate(-6vw, 8vh) scale(0.9);
  }
}

/* Giant editorial monogram behind everything */
.pv-bg-word {
  position: absolute;
  right: -2vw;
  bottom: -9vw;
  font-size: 30vw;
  font-weight: 900;
  letter-spacing: -0.05em;
  line-height: 1;
  color: transparent;
  -webkit-text-stroke: 1.5px color-mix(in srgb, var(--pa) 26%, transparent);
  opacity: 0.5;
  user-select: none;
  animation: pv-word-drift 60s ease-in-out infinite alternate;
}
@keyframes pv-word-drift {
  to {
    transform: translateX(-3vw);
  }
}

.pv-vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(120% 90% at 50% 30%, transparent 55%, rgba(0, 0, 0, 0.28));
}
[data-theme='light'] .pv-vignette {
  background: radial-gradient(120% 90% at 50% 30%, transparent 60%, rgba(30, 40, 80, 0.1));
}

/* Cursor-following light */
.pv-spotlight {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
  width: 760px;
  height: 760px;
  margin: -380px 0 0 -380px;
  border-radius: 50%;
  pointer-events: none;
  background: radial-gradient(
    closest-side,
    color-mix(in srgb, var(--pa) 9%, transparent),
    transparent 70%
  );
  will-change: transform;
}

/* ═══════════════════════════════ Chrome ═══════════════════════════════════ */
.pv-chrome {
  position: relative;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 20px 6px;
  animation: pv-chrome-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.08s backwards;
}
@keyframes pv-chrome-in {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
}

.pv-back {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  max-width: 340px;
  padding: 8px 14px 8px 11px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--glass-strong);
  backdrop-filter: blur(12px);
  color: var(--t1);
  font-family: var(--font);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color 0.2s,
    box-shadow 0.25s,
    transform 0.2s;
}
.pv-back:hover {
  border-color: color-mix(in srgb, var(--pa) 45%, transparent);
  box-shadow: 0 0 16px color-mix(in srgb, var(--pa) 22%, transparent);
  transform: translateX(-2px);
}
.pv-back-arrow {
  font-size: 15px;
  transition: transform 0.2s;
}
.pv-back:hover .pv-back-arrow {
  transform: translateX(-3px);
}
.pv-back-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pv-kbd {
  padding: 1px 6px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--elevated);
  color: var(--t3);
  font-size: 10px;
  font-family: var(--font);
}

.pv-chrome-spacer {
  flex: 1;
}

.pv-act {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 15px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--glass-strong);
  backdrop-filter: blur(12px);
  color: var(--t1);
  font-family: var(--font);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color 0.2s,
    box-shadow 0.25s,
    transform 0.2s,
    color 0.2s;
}
.pv-act:hover {
  border-color: color-mix(in srgb, var(--pa) 45%, transparent);
  box-shadow: 0 0 16px color-mix(in srgb, var(--pa) 22%, transparent);
  transform: translateY(-1px);
}
.pv-act-danger:hover {
  color: #ef5350;
  border-color: rgba(239, 83, 80, 0.5);
  box-shadow: 0 0 16px rgba(239, 83, 80, 0.2);
}

.pv-x {
  width: 36px;
  height: 36px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--glass-strong);
  backdrop-filter: blur(12px);
  color: var(--t2);
  font-size: 14px;
  cursor: pointer;
  transition:
    color 0.2s,
    border-color 0.2s,
    transform 0.25s;
}
.pv-x:hover {
  color: var(--t1);
  transform: rotate(90deg);
}

/* ═══════════════════════════════ Stage ════════════════════════════════════ */
.pv-stage {
  position: relative;
  z-index: 2;
  flex: 1 1 0;
  min-height: 0;
}

.pv-main {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: minmax(320px, 400px) minmax(0, 1fr);
  gap: 40px;
  padding: 8px 44px 0;
  max-width: 1500px;
  margin: 0 auto;
  width: 100%;
}

/* Person-to-person travel */
.pv-nav-f-enter-active,
.pv-nav-b-enter-active {
  transition:
    opacity 0.42s ease,
    transform 0.5s cubic-bezier(0.22, 1, 0.36, 1),
    filter 0.42s ease;
}
.pv-nav-f-leave-active,
.pv-nav-b-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.34s ease,
    filter 0.3s ease;
}
.pv-nav-f-enter-from {
  opacity: 0;
  transform: translateX(70px) scale(0.985);
  filter: blur(8px);
}
.pv-nav-f-leave-to {
  opacity: 0;
  transform: translateX(-70px) scale(0.985);
  filter: blur(8px);
}
.pv-nav-b-enter-from {
  opacity: 0;
  transform: translateX(-70px) scale(0.985);
  filter: blur(8px);
}
.pv-nav-b-leave-to {
  opacity: 0;
  transform: translateX(70px) scale(0.985);
  filter: blur(8px);
}

/* ═══════════════════════════ Identity column ══════════════════════════════ */
.pv-identity {
  overflow-y: auto;
  scrollbar-width: none;
  padding: 10px 6px 40px;
}
.pv-identity::-webkit-scrollbar {
  display: none;
}

/* 3D tilt portrait card */
.pv-card {
  perspective: 1100px;
  cursor: pointer;
  animation: pv-card-in 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.12s backwards;
}
@keyframes pv-card-in {
  from {
    opacity: 0;
    transform: translateY(26px) scale(0.96);
    filter: blur(10px);
  }
}

.pv-card-float {
  animation: pv-levitate 7.5s ease-in-out infinite;
  transform-style: preserve-3d;
}
@keyframes pv-levitate {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-7px);
  }
}

.pv-card-inner {
  position: relative;
  aspect-ratio: 3 / 3.9;
  border-radius: 22px;
  overflow: hidden;
  transform: rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
  transition: transform 0.16s ease-out;
  background: linear-gradient(
    160deg,
    color-mix(in srgb, var(--pa) 30%, var(--elevated)),
    var(--elevated) 55%,
    color-mix(in srgb, var(--pa) 14%, var(--elevated))
  );
  box-shadow:
    0 30px 60px -18px rgba(0, 0, 0, 0.55),
    0 0 40px -14px color-mix(in srgb, var(--pa) 55%, transparent);
}
[data-theme='light'] .pv-card-inner {
  box-shadow:
    0 24px 50px -20px rgba(30, 40, 80, 0.35),
    0 0 34px -14px color-mix(in srgb, var(--pa) 45%, transparent);
}
.pv-card-tilting .pv-card-float {
  animation-play-state: paused;
}

.pv-card-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(1.03) translateZ(0);
}
.pv-card-dead .pv-card-img {
  filter: grayscale(0.35) sepia(0.12);
}

/* Monogram fallback when no portrait exists */
.pv-monogram {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.pv-monogram-text {
  font-size: 96px;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: color-mix(in srgb, var(--pa) 80%, var(--t1));
  text-shadow: 0 0 44px color-mix(in srgb, var(--pa) 55%, transparent);
}
.pv-monogram-halo {
  position: absolute;
  width: 210px;
  height: 210px;
  border-radius: 50%;
  border: 1.5px dashed color-mix(in srgb, var(--pa) 45%, transparent);
  animation: pv-spin 26s linear infinite;
}
.pv-monogram-halo::after {
  content: '';
  position: absolute;
  inset: 22px;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--pa) 28%, transparent);
}

/* Cursor-tracking specular sheen */
.pv-card-glare {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(
    520px circle at var(--mx, 50%) var(--my, 40%),
    rgba(255, 255, 255, 0.16),
    transparent 46%
  );
  mix-blend-mode: overlay;
}
.pv-card-rim {
  position: absolute;
  inset: 0;
  border-radius: 22px;
  pointer-events: none;
  border: 1px solid color-mix(in srgb, var(--pa) 35%, var(--border));
  mask: linear-gradient(200deg, black, transparent 70%);
}

.pv-memoriam {
  position: absolute;
  left: 12px;
  bottom: 12px;
  padding: 4px 11px;
  border-radius: 20px;
  background: rgba(10, 12, 20, 0.55);
  backdrop-filter: blur(6px);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: rgba(255, 255, 255, 0.85);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.4px;
}

/* Name: letter-by-letter rise */
.pv-name {
  margin-top: 22px;
  font-size: clamp(26px, 2.6vw, 38px);
  font-weight: 800;
  letter-spacing: -0.015em;
  line-height: 1.12;
  color: var(--t1);
  text-shadow: 0 0 30px color-mix(in srgb, var(--pa) 30%, transparent);
  word-break: break-word;
}
.pv-ch {
  display: inline-block;
  animation: pv-ch-in 0.55s cubic-bezier(0.22, 1, 0.36, 1) calc(0.18s + var(--d, 0s)) backwards;
}
@keyframes pv-ch-in {
  from {
    opacity: 0;
    transform: translateY(16px) rotate(4deg);
    filter: blur(5px);
  }
}

.pv-name-rule {
  height: 3px;
  width: 88px;
  margin-top: 10px;
  border-radius: 3px;
  background: linear-gradient(90deg, var(--pa), transparent);
  transform-origin: left;
  animation: pv-rule-in 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.5s backwards;
}
@keyframes pv-rule-in {
  from {
    transform: scaleX(0);
  }
}

/* Lifespan */
.pv-lifespan {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
  font-size: 14px;
  color: var(--t2);
  animation: pv-rise 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.42s backwards;
}
.pv-year {
  font-weight: 700;
  color: var(--t1);
  font-variant-numeric: tabular-nums;
}
.pv-life-line {
  position: relative;
  flex: 0 0 44px;
  height: 2px;
  border-radius: 2px;
  background: linear-gradient(
    90deg,
    transparent,
    color-mix(in srgb, var(--pa) 60%, transparent),
    transparent
  );
}
.pv-life-dot {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 7px;
  height: 7px;
  margin: -3.5px 0 0 -3.5px;
  border-radius: 50%;
  background: var(--pa);
}
.pv-life-dot.pv-alive {
  animation: pv-pulse 2.2s ease-in-out infinite;
}
@keyframes pv-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--pa) 55%, transparent);
  }
  55% {
    box-shadow: 0 0 0 9px transparent;
  }
}
.pv-age {
  padding: 2px 9px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--pa) 16%, transparent);
  color: color-mix(in srgb, var(--pa) 75%, var(--t1));
  font-size: 11px;
  font-weight: 700;
}
.pv-dim {
  color: var(--t3);
}

/* Fact chips + tags */
.pv-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 16px;
  animation: pv-rise 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.5s backwards;
}
.pv-chip {
  padding: 5px 12px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: var(--glass-soft);
  color: var(--t2);
  font-size: 12px;
  font-weight: 500;
  text-transform: capitalize;
}

.pv-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 12px;
  animation: pv-rise 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.58s backwards;
}
.pv-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 20px;
  border: 1px solid color-mix(in srgb, var(--tc) 40%, transparent);
  background: color-mix(in srgb, var(--tc) 12%, transparent);
  color: var(--t1);
  font-size: 12px;
  font-weight: 600;
}
.pv-tag-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--tc);
  box-shadow: 0 0 8px color-mix(in srgb, var(--tc) 70%, transparent);
}

/* Stat tiles */
.pv-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-top: 24px;
}
.pv-stat {
  padding: 13px 8px 11px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--glass-strong);
  backdrop-filter: blur(10px);
  text-align: center;
  animation: pv-rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) calc(0.6s + var(--i, 0) * 0.07s) backwards;
  transition:
    border-color 0.25s,
    box-shadow 0.3s,
    transform 0.25s;
}
.pv-stat:hover {
  border-color: color-mix(in srgb, var(--pa) 40%, transparent);
  box-shadow: 0 6px 20px -8px color-mix(in srgb, var(--pa) 45%, transparent);
  transform: translateY(-3px);
}
.pv-stat-val {
  display: block;
  font-size: 22px;
  font-weight: 800;
  color: var(--t1);
  font-variant-numeric: tabular-nums;
}
.pv-stat-key {
  display: block;
  margin-top: 1px;
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.9px;
  text-transform: uppercase;
  color: var(--t3);
}

@keyframes pv-rise {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
}

/* ═══════════════════════════ Detail column ════════════════════════════════ */
.pv-content {
  overflow-y: auto;
  padding: 10px 26px 0 4px;
  min-width: 0;
}
.pv-content-tail {
  height: 70px;
}

.pv-section {
  margin-bottom: 44px;
  animation: pv-section-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) calc(0.16s + var(--i, 0) * 0.09s)
    backwards;
}
@keyframes pv-section-in {
  from {
    opacity: 0;
    transform: translateY(26px);
    filter: blur(6px);
  }
}

.pv-h {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 16px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 2.2px;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--pa) 65%, var(--t2));
}
.pv-h::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--pa) 35%, transparent), transparent);
}
.pv-h-sub {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: none;
  color: var(--t3);
}

/* ── Constellation ── */
.pv-orbit {
  position: relative;
  height: 330px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.pv-orbit-lg {
  height: 500px;
}

.pv-ring {
  position: absolute;
  border-radius: 50%;
  border: 1.5px dashed color-mix(in srgb, var(--pa) 26%, transparent);
  pointer-events: none;
}
.pv-ring-1 {
  width: 236px;
  height: 236px;
  animation: pv-spin 90s linear infinite;
}
.pv-orbit-lg .pv-ring-1 {
  width: 264px;
  height: 264px;
}
.pv-ring-2 {
  width: 416px;
  height: 416px;
  border-color: color-mix(in srgb, var(--pa) 15%, transparent);
  animation: pv-spin-rev 130s linear infinite;
}
@keyframes pv-spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes pv-spin-rev {
  to {
    transform: rotate(-360deg);
  }
}

.pv-orbit-center {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
}
.pv-orbit-halo {
  position: absolute;
  width: 96px;
  height: 96px;
  border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--pa) 55%, transparent);
  animation: pv-halo 2.8s ease-out infinite;
}
@keyframes pv-halo {
  from {
    transform: scale(1);
    opacity: 0.9;
  }
  to {
    transform: scale(1.65);
    opacity: 0;
  }
}
.pv-orbit-me {
  width: 84px;
  height: 84px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid color-mix(in srgb, var(--pa) 70%, transparent);
  background: color-mix(in srgb, var(--pa) 22%, var(--elevated));
  box-shadow: 0 0 34px -6px color-mix(in srgb, var(--pa) 60%, transparent);
  font-size: 24px;
  font-weight: 800;
  color: var(--t1);
}
.pv-orbit-me img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Rotating carriers + counter-rotating chip content (stays upright) */
.pv-spinner {
  position: absolute;
  width: 0;
  height: 0;
}
.pv-spin-1 {
  animation: pv-spin 90s linear infinite;
}
.pv-spin-2 {
  animation: pv-spin-rev 130s linear infinite;
}
/* Counter-rotation keeps chip content upright while its carrier orbits. The
   keyframes must repeat the centering translate — an animated transform
   replaces the static one entirely. */
.pv-counter-1 {
  animation: pv-counter 90s linear infinite;
}
.pv-counter-2 {
  animation: pv-counter-rev 130s linear infinite;
}
@keyframes pv-counter {
  from {
    transform: translate(-50%, -50%) rotate(0deg);
  }
  to {
    transform: translate(-50%, -50%) rotate(-360deg);
  }
}
@keyframes pv-counter-rev {
  from {
    transform: translate(-50%, -50%) rotate(0deg);
  }
  to {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}
.pv-orbit:hover .pv-spinner,
.pv-orbit:hover .pv-sat-inner,
.pv-orbit:hover .pv-ring {
  animation-play-state: paused;
}

.pv-sat {
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  overflow: visible;
}
.pv-sat-inner {
  position: absolute;
  top: 0;
  left: 0;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.pv-sat-avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid color-mix(in srgb, var(--pa) 45%, var(--border));
  background: var(--elevated);
  color: var(--t2);
  font-size: 15px;
  font-weight: 700;
  box-shadow: 0 6px 18px -6px rgba(0, 0, 0, 0.5);
  transition:
    transform 0.25s cubic-bezier(0.34, 1.4, 0.64, 1),
    border-color 0.25s,
    box-shadow 0.3s;
}
.pv-sat-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.pv-sat-2 .pv-sat-avatar {
  width: 38px;
  height: 38px;
  font-size: 12px;
  opacity: 0.85;
  border-color: var(--border);
}
.pv-sat:hover .pv-sat-avatar {
  transform: scale(1.22);
  border-color: var(--pa);
  box-shadow: 0 0 22px -2px color-mix(in srgb, var(--pa) 65%, transparent);
}
.pv-sat-ended .pv-sat-avatar {
  opacity: 0.5;
  filter: grayscale(0.6);
}

.pv-sat-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 110px;
  padding: 3px 9px;
  border-radius: 9px;
  background: var(--glass-strong);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border);
  color: var(--t1);
  font-size: 10.5px;
  font-weight: 600;
  line-height: 1.25;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pv-sat-label b {
  font-size: 8.5px;
  font-weight: 800;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--pa) 75%, var(--t2));
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pv-sat-2 .pv-sat-label {
  opacity: 0;
  transform: translateY(-4px);
  transition:
    opacity 0.2s,
    transform 0.25s;
}
.pv-sat-2:hover .pv-sat-label {
  opacity: 1;
  transform: translateY(0);
}

/* ── Story ── */
.pv-bio {
  font-size: 14.5px;
  line-height: 1.85;
  color: var(--t2);
  white-space: pre-wrap;
  max-width: 720px;
}
/* Editorial drop cap — only for bios long enough to wrap around it */
.pv-bio-cap::first-letter {
  float: left;
  font-size: 44px;
  line-height: 0.82;
  padding: 5px 7px 0 0;
  font-weight: 800;
  color: color-mix(in srgb, var(--pa) 80%, var(--t1));
}

/* ── Traits ── */
.pv-traits {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 12px;
}
.pv-trait {
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--glass-strong);
  backdrop-filter: blur(10px);
  animation: pv-rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) calc(0.3s + var(--i, 0) * 0.05s) backwards;
  transition:
    border-color 0.25s,
    transform 0.25s,
    box-shadow 0.3s;
}
.pv-trait:hover {
  border-color: color-mix(in srgb, var(--pa) 38%, transparent);
  transform: translateY(-3px);
  box-shadow: 0 10px 26px -12px color-mix(in srgb, var(--pa) 40%, transparent);
}
.pv-trait-wide {
  grid-column: 1 / -1;
}
.pv-trait-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--t3);
  margin-bottom: 7px;
}
.pv-trait-icon {
  font-size: 13px;
}
.pv-trait-value {
  font-size: 15px;
  font-weight: 600;
  color: var(--t1);
  display: flex;
  align-items: center;
  gap: 8px;
}
.pv-trait-para {
  font-size: 13px;
  line-height: 1.65;
  color: var(--t2);
  white-space: pre-wrap;
}
.pv-select-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  box-shadow: 0 0 10px currentColor;
}
.pv-bool-yes {
  color: var(--green);
}
.pv-bool-no {
  color: var(--t3);
}

/* Slider trait bar */
.pv-bar {
  position: relative;
  height: 8px;
  border-radius: 6px;
  background: var(--elevated);
  overflow: visible;
}
.pv-bar-fill {
  height: 100%;
  border-radius: 6px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--pa) 55%, transparent), var(--pa));
  transform-origin: left;
  animation: pv-bar-in 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.45s backwards;
  box-shadow: 0 0 12px -2px color-mix(in srgb, var(--pa) 60%, transparent);
}
@keyframes pv-bar-in {
  from {
    transform: scaleX(0);
  }
}
.pv-bar-spark {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  margin: -6px 0 0 -6px;
  border-radius: 50%;
  background: var(--pa);
  border: 2px solid var(--surface);
  box-shadow: 0 0 10px color-mix(in srgb, var(--pa) 80%, transparent);
  animation: pv-rise 0.5s ease 0.9s backwards;
}
.pv-bar-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 7px;
  font-size: 10px;
  color: var(--t3);
  font-weight: 600;
}

/* ── Chronicle ── */
.pv-chron {
  position: relative;
  padding-left: 4px;
}
.pv-ev {
  display: grid;
  grid-template-columns: 92px 26px 1fr;
  align-items: baseline;
  gap: 8px;
  padding: 7px 0;
  animation: pv-ev-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) calc(0.35s + var(--i, 0) * 0.06s)
    backwards;
}
@keyframes pv-ev-in {
  from {
    opacity: 0;
    transform: translateX(-18px);
  }
}
.pv-ev-link {
  cursor: pointer;
  border-radius: 10px;
  transition: background 0.2s;
}
.pv-ev-link:hover {
  background: color-mix(in srgb, var(--pa) 7%, transparent);
}
.pv-ev-year {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--t2);
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.pv-ev-node {
  position: relative;
  align-self: stretch;
  display: flex;
  align-items: center;
  justify-content: center;
}
.pv-ev-node::before {
  content: '';
  position: absolute;
  top: -8px;
  bottom: -8px;
  width: 1.5px;
  background: color-mix(in srgb, var(--pa) 22%, transparent);
}
.pv-ev:first-child .pv-ev-node::before {
  top: 50%;
}
.pv-ev:last-child .pv-ev-node::before {
  bottom: 50%;
}
.pv-ev-dot {
  position: relative;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--pa);
  box-shadow: 0 0 10px color-mix(in srgb, var(--pa) 70%, transparent);
}
.pv-ev-birth {
  background: var(--amber);
  box-shadow: 0 0 10px rgba(245, 166, 35, 0.6);
}
.pv-ev-union {
  background: var(--pink);
  box-shadow: 0 0 10px rgba(240, 98, 146, 0.6);
}
.pv-ev-child {
  background: var(--green);
  box-shadow: 0 0 10px rgba(76, 175, 114, 0.6);
}
.pv-ev-ended {
  background: var(--t3);
  box-shadow: none;
}
.pv-ev-death {
  background: var(--t2);
  box-shadow: 0 0 12px rgba(255, 255, 255, 0.25);
}
.pv-ev-body {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  flex-wrap: wrap;
}
.pv-ev-glyph {
  font-size: 12px;
}
.pv-ev-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--t1);
}
.pv-ev-sub {
  font-size: 11.5px;
  color: var(--t3);
}

/* ── Bonds ── */
.pv-band {
  margin-bottom: 18px;
}
.pv-band-name {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1.4px;
  text-transform: uppercase;
  color: var(--t3);
  margin-bottom: 9px;
}
.pv-band-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
}
.pv-bond {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 7px 14px 7px 8px;
  border-radius: 30px;
  border: 1px solid color-mix(in srgb, var(--bc, var(--pa)) 30%, var(--border));
  background: color-mix(in srgb, var(--bc, var(--pa)) 8%, var(--glass-strong));
  cursor: pointer;
  font-family: var(--font);
  animation: pv-rise 0.45s cubic-bezier(0.22, 1, 0.36, 1) calc(0.35s + var(--i, 0) * 0.045s)
    backwards;
  transition:
    transform 0.22s cubic-bezier(0.34, 1.3, 0.64, 1),
    border-color 0.22s,
    box-shadow 0.28s;
}
.pv-bond:hover {
  transform: translateY(-3px) scale(1.03);
  border-color: color-mix(in srgb, var(--bc, var(--pa)) 65%, transparent);
  box-shadow: 0 8px 22px -8px color-mix(in srgb, var(--bc, var(--pa)) 55%, transparent);
}
.pv-bond-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--elevated);
  color: var(--t2);
  font-size: 10px;
  font-weight: 700;
  flex-shrink: 0;
}
.pv-bond-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.pv-bond-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.25;
}
.pv-bond-role {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.7px;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--bc, var(--pa)) 80%, var(--t2));
}
.pv-bond-name {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--t1);
}
.pv-bond-ended {
  opacity: 0.55;
}
.pv-bond-ended .pv-bond-name {
  text-decoration: line-through;
  text-decoration-color: var(--t3);
}
.pv-bond-endtag {
  font-size: 9.5px;
  font-weight: 700;
  color: var(--t3);
  padding-left: 2px;
}

/* ── Gallery ── */
.pv-gallery {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding: 4px 2px 12px;
  scroll-snap-type: x proximity;
}
.pv-photo {
  position: relative;
  flex: 0 0 auto;
  height: 170px;
  min-width: 120px;
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
  padding: 0;
  background: var(--elevated);
  cursor: zoom-in;
  scroll-snap-align: start;
  animation: pv-rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) calc(0.35s + var(--i, 0) * 0.06s) backwards;
  transition:
    transform 0.3s cubic-bezier(0.22, 1, 0.36, 1),
    border-color 0.25s,
    box-shadow 0.3s;
}
.pv-photo img {
  height: 100%;
  width: auto;
  min-width: 120px;
  object-fit: cover;
  display: block;
  transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}
.pv-photo:hover {
  transform: translateY(-5px);
  border-color: color-mix(in srgb, var(--pa) 50%, transparent);
  box-shadow: 0 14px 30px -12px color-mix(in srgb, var(--pa) 50%, transparent);
}
.pv-photo:hover img {
  transform: scale(1.07);
}
.pv-photo-role {
  position: absolute;
  left: 8px;
  bottom: 8px;
  padding: 2px 9px;
  border-radius: 12px;
  background: rgba(10, 12, 20, 0.6);
  backdrop-filter: blur(6px);
  color: rgba(255, 255, 255, 0.9);
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: capitalize;
}
.pv-photo-star {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(10, 12, 20, 0.55);
  color: #ffd76a;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── Blank slate ── */
.pv-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 70px 20px;
  text-align: center;
}
.pv-empty-mark {
  font-size: 34px;
  color: var(--pa);
  animation: pv-pulse 2.4s ease-in-out infinite;
  border-radius: 50%;
}
.pv-empty-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--t1);
}
.pv-empty-text {
  font-size: 13px;
  color: var(--t3);
  max-width: 380px;
}
.pv-empty-cta {
  margin-top: 10px;
}

/* ═══════════════════════════════ Lightbox ═════════════════════════════════ */
.pv-lightbox {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  background: rgba(6, 8, 14, 0.82);
  backdrop-filter: blur(16px);
}
.pv-lb-frame {
  position: relative;
  max-width: min(84vw, 1100px);
  max-height: 82%;
  display: flex;
  flex-direction: column;
}
.pv-lb-frame img {
  max-width: 100%;
  max-height: calc(82vh - 110px);
  object-fit: contain;
  border-radius: 14px;
  box-shadow:
    0 40px 90px -20px rgba(0, 0, 0, 0.8),
    0 0 60px -20px color-mix(in srgb, var(--pa) 60%, transparent);
  animation: pv-lb-img-in 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes pv-lb-img-in {
  from {
    opacity: 0;
    transform: scale(0.94);
  }
}
.pv-lb-caption {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: center;
  margin-top: 14px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 13px;
  font-weight: 600;
}
.pv-lb-role {
  padding: 2px 10px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--pa) 30%, transparent);
  font-size: 10.5px;
  font-weight: 700;
  text-transform: capitalize;
}
.pv-lb-count {
  color: rgba(255, 255, 255, 0.45);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.pv-lb-nav {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.07);
  color: #fff;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  transition:
    background 0.2s,
    transform 0.2s;
  flex-shrink: 0;
}
.pv-lb-nav:hover {
  background: rgba(255, 255, 255, 0.16);
  transform: scale(1.08);
}
.pv-lb-x {
  position: absolute;
  top: 18px;
  right: 20px;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.07);
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  transition:
    background 0.2s,
    transform 0.25s;
}
.pv-lb-x:hover {
  background: rgba(255, 255, 255, 0.16);
  transform: rotate(90deg);
}

.pv-lb-enter-active,
.pv-lb-leave-active {
  transition: opacity 0.25s ease;
}
.pv-lb-enter-from,
.pv-lb-leave-to {
  opacity: 0;
}

/* ═══════════════════════ Overlay enter/leave ══════════════════════════════ */
.pv-enter-active {
  transition:
    opacity 0.4s ease,
    transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}
.pv-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.35s ease;
}
.pv-enter-from {
  opacity: 0;
  transform: scale(1.045);
}
.pv-leave-to {
  opacity: 0;
  transform: scale(0.985);
}

/* ═══════════════════════════ Responsive ═══════════════════════════════════ */
@media (max-width: 1020px) {
  .pv-main {
    grid-template-columns: 1fr;
    overflow-y: auto;
    gap: 26px;
    padding: 8px 24px 0;
  }
  .pv-identity,
  .pv-content {
    overflow: visible;
    padding-right: 0;
  }
  .pv-card {
    max-width: 320px;
  }
  .pv-bg-word {
    font-size: 44vw;
  }
}

/* ═══════════════════════ Reduced motion ═══════════════════════════════════ */
@media (prefers-reduced-motion: reduce) {
  .pv-bg-photo,
  .pv-aurora,
  .pv-bg-word,
  .pv-card-float,
  .pv-monogram-halo,
  .pv-ring,
  .pv-spinner,
  .pv-sat-inner,
  .pv-orbit-halo,
  .pv-life-dot,
  .pv-empty-mark,
  .pv-ch,
  .pv-name-rule,
  .pv-card,
  .pv-chrome,
  .pv-lifespan,
  .pv-chips,
  .pv-tags,
  .pv-stat,
  .pv-section,
  .pv-trait,
  .pv-ev,
  .pv-bond,
  .pv-photo,
  .pv-bar-fill,
  .pv-bar-spark {
    animation: none;
  }
}
</style>
