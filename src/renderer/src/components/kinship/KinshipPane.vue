<template>
  <!-- The graph's Kinship pane. Three tabs:
       Lens     — see the whole graph through one person's eyes: every node
                  labelled with what it is to them, coloured by kind of kin.
       Walk     — say a chain ("mother's brother's daughter") and watch who it
                  lands on light up.
       Insights — the structure: linchpins who hold branches together, dynasty
                  founders, couples who share blood, family islands. -->
  <div class="kp canvas-pane" @pointerdown.stop @wheel.stop>
    <div class="kp-head">
      <span class="kp-title"><span class="kp-title-ic">🧬</span>Kinship</span>
      <KinLangPicker />
      <button
        class="kp-quiz"
        title="Kinship quiz — how well do you know this family?"
        @click="$emit('quiz')"
      >
        🎲 Quiz
      </button>
    </div>

    <div class="kp-tabs" role="tablist">
      <span class="kp-tab-thumb" :style="{ transform: `translateX(${tabIdx * 100}%)` }"></span>
      <button
        v-for="t in TABS"
        :key="t.id"
        class="kp-tab"
        :class="{ on: tab === t.id }"
        role="tab"
        :aria-selected="tab === t.id"
        @click="tab = t.id"
      >
        {{ t.label }}
      </button>
    </div>

    <!-- Anchor: whose eyes (shared by Lens + Walk) -->
    <div v-if="tab !== 'insights'" class="kp-anchor">
      <template v-if="anchorId">
        <span class="kp-avatar" :style="{ '--pc': personColor(anchorId) }">{{
          initials(anchorId)
        }}</span>
        <div class="kp-anchor-text">
          <span class="kp-anchor-k">{{
            tab === 'lens' ? 'Through the eyes of' : 'Starting from'
          }}</span>
          <span class="kp-anchor-name">{{ personName(anchorId) }}</span>
        </div>
      </template>
      <span v-else class="kp-hint">Select someone on the graph to begin</span>
      <button
        v-if="selectedId && selectedId !== anchorId"
        class="kp-use"
        :title="`Use ${personName(selectedId)}`"
        @click="$emit('update:anchorId', selectedId)"
      >
        ⤓ Use {{ firstName(selectedId) }}
      </button>
    </div>

    <!-- ── Lens ─────────────────────────────────────────────────────────── -->
    <div v-if="tab === 'lens'" key="lens" class="kp-body">
      <button
        class="kp-eye"
        :class="{ on: lensOn && anchorId }"
        :disabled="!anchorId"
        @click="$emit('update:lensOn', !lensOn)"
      >
        <span class="kp-eye-ic">
          <span class="kp-eye-iris"></span>
        </span>
        <span class="kp-eye-text">
          <b>{{ lensOn && anchorId ? 'Lens on' : 'See the family through their eyes' }}</b>
          <small>{{
            lensOn && anchorId
              ? 'Every node now says what it is to ' + firstName(anchorId)
              : 'Labels every person with their relation'
          }}</small>
        </span>
      </button>

      <div class="kp-filter" :class="{ dim: !lensOn }">
        <button
          v-for="f in FILTERS"
          :key="f.id"
          class="kp-chip"
          :class="{ on: filter === f.id }"
          :title="f.title"
          @click="$emit('update:filter', f.id)"
        >
          {{ f.label }}
        </button>
      </div>

      <div class="kp-legend">
        <div
          v-for="(row, i) in classRows"
          :key="row.key"
          class="kp-leg-row cp-stagger"
          :style="{ '--i': i, '--kc': palette[row.key] }"
        >
          <span class="kp-leg-dot"></span>
          <span class="kp-leg-name">{{ row.label }}</span>
          <span class="kp-leg-count">{{ row.count }}</span>
          <span class="kp-leg-bar"><span :style="{ width: row.pct + '%' }"></span></span>
        </div>
      </div>

      <div v-if="closest.length" class="kp-sub">Closest kin</div>
      <div class="kp-list">
        <button
          v-for="(c, i) in closest"
          :key="c.id"
          class="kp-row cp-stagger"
          :style="{ '--i': i + 3, '--kc': palette[c.cls] }"
          @click="$emit('focus-person', c.id)"
        >
          <span class="kp-row-dot"></span>
          <span class="kp-row-name">{{ c.name }}</span>
          <span class="kp-row-rel">{{ c.rel }}</span>
        </button>
      </div>
    </div>

    <!-- ── Kin walker ───────────────────────────────────────────────────── -->
    <div v-else-if="tab === 'walk'" key="walk" class="kp-body">
      <div class="kp-walk-grid">
        <div v-for="row in WALK_ROWS" :key="row.label" class="kp-walk-row">
          <span class="kp-walk-label">{{ row.label }}</span>
          <button
            v-for="t in row.toks"
            :key="t"
            class="kp-tok"
            :disabled="!anchorId || chain.length >= 8"
            @click="chain.push(t)"
          >
            {{ tokenLabel(t, kinLang) }}
          </button>
        </div>
      </div>

      <div class="kp-chain" :class="{ empty: !chain.length }">
        <TransitionGroup name="tok">
          <button
            v-for="(t, i) in chain"
            :key="i + t"
            class="kp-chain-tok"
            title="Remove this step"
            @click="chain.splice(i, 1)"
          >
            {{ tokenLabel(t, kinLang) }}<span class="kp-chain-x">×</span>
          </button>
        </TransitionGroup>
        <span v-if="!chain.length" class="kp-hint">Tap steps to build a chain…</span>
        <button v-else class="kp-clear" title="Clear" @click="chain.splice(0)">⌫</button>
      </div>
      <div v-if="chain.length" class="kp-phrase">“{{ chainPhrase(chain, kinLang) }}”</div>

      <div v-if="chain.length" class="kp-sub">
        {{ walkResults.length ? `${walkResults.length} found` : 'Nobody on record' }}
      </div>
      <div class="kp-list">
        <button
          v-for="(c, i) in walkResults"
          :key="c.id"
          class="kp-row cp-stagger"
          :style="{ '--i': i, '--kc': palette[c.cls] || 'var(--accent)' }"
          @click="$emit('focus-person', c.id)"
        >
          <span class="kp-row-dot"></span>
          <span class="kp-row-name">{{ c.name }}</span>
          <span class="kp-row-rel">{{ c.rel }}</span>
        </button>
      </div>
    </div>

    <!-- ── Insights ─────────────────────────────────────────────────────── -->
    <div v-else key="insights" class="kp-body kp-insights">
      <div class="kp-stat-row">
        <div class="kp-stat" style="--i: 0">
          <b>{{ insights.islands.length }}</b
          ><span>{{ insights.islands.length === 1 ? 'family' : 'islands' }}</span>
        </div>
        <div class="kp-stat" style="--i: 1">
          <b>{{ insights.linchpins.length }}</b
          ><span>linchpins</span>
        </div>
        <div class="kp-stat" style="--i: 2">
          <b>{{ insights.tangled.length }}</b
          ><span>tangled</span>
        </div>
      </div>

      <template v-if="insights.linchpins.length">
        <div class="kp-sub" title="Remove one of these people and the family splits apart">
          🔗 Linchpins
        </div>
        <button
          v-for="(l, i) in insights.linchpins"
          :key="l.id"
          class="kp-row cp-stagger"
          :style="{ '--i': i, '--kc': 'var(--accent)' }"
          :title="`Without ${personName(l.id)}, ${l.cut} ${l.cut === 1 ? 'person is' : 'people are'} cut off`"
          @click="$emit('focus-person', l.id)"
        >
          <span class="kp-row-dot"></span>
          <span class="kp-row-name">{{ personName(l.id) }}</span>
          <span class="kp-row-meter"
            ><span :style="{ width: (l.cut / maxCut) * 100 + '%' }"></span
          ></span>
          <span class="kp-row-rel">holds {{ l.cut }}</span>
        </button>
      </template>

      <template v-if="insights.founders.length">
        <div class="kp-sub">👑 Dynasty founders</div>
        <button
          v-for="(f, i) in insights.founders"
          :key="f.id"
          class="kp-row cp-stagger"
          :style="{ '--i': i + 5, '--kc': 'var(--kin-blood)' }"
          @click="$emit('focus-person', f.id)"
        >
          <span class="kp-row-dot"></span>
          <span class="kp-row-name">{{ personName(f.id) }}</span>
          <span class="kp-row-rel">{{ f.descendants }} desc. · {{ f.generations }} gen</span>
        </button>
      </template>

      <template v-if="insights.tangled.length">
        <div class="kp-sub" title="Couples who are also blood relatives">🌀 Tangled roots</div>
        <button
          v-for="(t, i) in insights.tangled"
          :key="t.a + t.b"
          class="kp-row cp-stagger"
          :style="{ '--i': i + 8, '--kc': 'var(--kin-spouse)' }"
          @click="$emit('trace-pair', [t.a, t.b])"
        >
          <span class="kp-row-dot"></span>
          <span class="kp-row-name">{{ firstName(t.a) }} ⚭ {{ firstName(t.b) }}</span>
          <span class="kp-row-rel">{{ (t.phi * 100).toFixed(t.phi < 0.01 ? 2 : 1) }}%</span>
        </button>
      </template>

      <template v-if="insights.islands.length > 1">
        <div class="kp-sub" title="Groups with no connection to each other">🏝 Islands</div>
        <div class="kp-islands">
          <span
            v-for="(isl, i) in insights.islands.slice(0, 18)"
            :key="i"
            class="kp-isl cp-stagger"
            :style="{
              '--i': i,
              '--s': Math.max(6, Math.min(26, Math.sqrt(isl.length) * 5)) + 'px'
            }"
            :title="`${isl.length} ${isl.length === 1 ? 'person' : 'people'} — ${personName(isl[0])}…`"
            @click="$emit('focus-person', isl[0])"
          ></span>
        </div>
      </template>
      <div v-if="!insights.linchpins.length && !insights.founders.length" class="kp-hint">
        Add a few parents and children to see the structure.
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useKinship, kinClass, kinPalette } from './useKinship'
import { walkChain, linchpins, founders, tangledCouples, islands } from './kinshipGraph'
import { chainPhrase, tokenLabel } from './kinshipNames'
import KinLangPicker from './KinLangPicker.vue'

const props = defineProps({
  anchorId: { type: String, default: null },
  selectedId: { type: String, default: null },
  lensOn: { type: Boolean, default: false },
  filter: { type: String, default: 'all' }
})
const emit = defineEmits([
  'update:anchorId',
  'update:lensOn',
  'update:filter',
  'highlight',
  'focus-person',
  'trace-pair',
  'quiz'
])

const K = useKinship()
const { personName, personColor, kinLang } = K
const palette = computed(() => {
  void kinLang.value
  return kinPalette()
})

const TABS = [
  { id: 'lens', label: '👁 Lens' },
  { id: 'walk', label: '🧭 Walk' },
  { id: 'insights', label: '✦ Insights' }
]
const tab = ref('lens')
const tabIdx = computed(() => TABS.findIndex((t) => t.id === tab.value))

const FILTERS = [
  { id: 'all', label: 'All', title: 'Everyone, labelled' },
  { id: 'blood', label: 'Blood', title: 'Blood relatives only' },
  { id: 'marriage', label: 'Marriage', title: 'Spouses, in-laws and step-family' },
  { id: 'ancestors', label: 'Ancestors', title: 'The direct line upward' },
  { id: 'descendants', label: 'Descendants', title: 'Everyone descended from them' }
]

const firstName = (id) => personName(id).split(' ')[0]
function initials(id) {
  const parts = personName(id).trim().split(/\s+/)
  return (
    (parts[0]?.[0] || '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')
  ).toUpperCase()
}

// ── Lens ──────────────────────────────────────────────────────────────────
const lens = computed(() => K.lensOf(props.anchorId))
const CLASS_LABELS = {
  blood: 'Blood',
  spouse: 'Spouse',
  marriage: 'By marriage',
  step: 'Step-family',
  social: 'Social',
  distant: 'Further out'
}
const classRows = computed(() => {
  const counts = {}
  for (const [id, k] of lens.value) {
    if (id === props.anchorId) continue
    const c = kinClass(k)
    counts[c] = (counts[c] || 0) + 1
  }
  const total = Math.max(
    1,
    Object.values(counts).reduce((a, b) => a + b, 0)
  )
  return Object.keys(CLASS_LABELS)
    .filter((k) => counts[k])
    .map((k) => ({
      key: k,
      label: CLASS_LABELS[k],
      count: counts[k],
      pct: (counts[k] / total) * 100
    }))
})
const closest = computed(() => {
  if (!props.anchorId) return []
  const rows = []
  for (const [id, k] of lens.value) {
    if (id === props.anchorId || k.kind === 'distant' || k.kind === 'social') continue
    const dist = k.kind === 'spouse' ? 0.5 : k.up + k.down + (k.kind === 'blood' ? 0 : 1.5)
    rows.push({ id, dist, k })
  }
  rows.sort((a, b) => a.dist - b.dist)
  return rows.slice(0, 7).map((r) => ({
    id: r.id,
    name: personName(r.id),
    rel: K.nameOf(r.k, props.anchorId, r.id),
    cls: kinClass(r.k)
  }))
})

// ── Walker ────────────────────────────────────────────────────────────────
const WALK_ROWS = [
  { label: 'Up', toks: ['F', 'M', 'P'] },
  { label: 'Across', toks: ['B', 'Z', 'X'] },
  { label: 'Down', toks: ['S', 'D', 'C'] },
  { label: 'Married', toks: ['H', 'W', 'E'] }
]
const chain = reactive([])
watch(
  () => props.anchorId,
  () => chain.splice(0)
)
const walkIds = computed(() =>
  props.anchorId && chain.length ? walkChain(K.index.value, props.anchorId, [...chain]) : null
)
const walkResults = computed(() => {
  if (!walkIds.value) return []
  return [...walkIds.value].map((id) => {
    const k = lens.value.get(id)
    return { id, name: personName(id), rel: K.nameOf(k, props.anchorId, id), cls: kinClass(k) }
  })
})
// Light the walked-to people on the graph while the Walk tab is up.
watch(
  [walkIds, tab],
  () => {
    if (tab.value === 'walk' && walkIds.value && props.anchorId) {
      emit('highlight', new Set([props.anchorId, ...walkIds.value]))
    } else emit('highlight', null)
  },
  { immediate: true }
)

// ── Insights (computed only while the tab is open) ────────────────────────
const insights = computed(() => {
  if (tab.value !== 'insights') return { linchpins: [], founders: [], tangled: [], islands: [] }
  const idx = K.index.value
  return {
    linchpins: linchpins(idx).slice(0, 5),
    founders: founders(idx, 3),
    tangled: tangledCouples(idx).slice(0, 4),
    islands: islands(idx)
  }
})
const maxCut = computed(() => Math.max(1, ...insights.value.linchpins.map((l) => l.cut)))
</script>

<style scoped>
.kp {
  width: 272px;
  padding: 12px 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 9px;
  max-height: calc(100vh - 220px);
  overflow: hidden;
}
.kp-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.kp-title {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: var(--t3);
  margin-right: auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.kp-title-ic {
  font-size: 13px;
  display: inline-block;
  animation: kp-spin 6s ease-in-out infinite;
}
@keyframes kp-spin {
  50% {
    transform: rotate(180deg);
  }
}
.kp-quiz {
  border: 1px solid color-mix(in srgb, var(--kin-blood) 40%, transparent);
  background: color-mix(in srgb, var(--kin-blood) 14%, transparent);
  color: var(--t1);
  border-radius: var(--r-pill);
  padding: 2px 9px;
  font-family: var(--font);
  font-size: 10.5px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  transition: transform 0.2s var(--ease-spring);
}
.kp-quiz:hover {
  transform: translateY(-1px) rotate(-3deg);
}

.kp-tabs {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  padding: 3px;
  border-radius: 10px;
  background: var(--elevated);
}
.kp-tab-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: calc((100% - 6px) / 3);
  height: calc(100% - 6px);
  border-radius: 8px;
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  transition: transform 0.34s var(--ease-spring);
}
.kp-tab {
  position: relative;
  z-index: 1;
  border: none;
  background: transparent;
  font-family: var(--font);
  font-size: 11px;
  font-weight: 700;
  color: var(--t3);
  padding: 5px 0;
  cursor: pointer;
  transition: color 0.2s ease;
}
.kp-tab.on {
  color: var(--t1);
}

.kp-anchor {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
}
.kp-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--pc);
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  box-shadow:
    0 0 0 2px var(--surface),
    0 0 0 3.5px var(--pc),
    0 0 14px color-mix(in srgb, var(--pc) 55%, transparent);
  animation: kp-pulse 2.6s ease-in-out infinite;
  flex-shrink: 0;
}
@keyframes kp-pulse {
  50% {
    box-shadow:
      0 0 0 2px var(--surface),
      0 0 0 5px color-mix(in srgb, var(--pc) 60%, transparent),
      0 0 22px color-mix(in srgb, var(--pc) 60%, transparent);
  }
}
.kp-anchor-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.kp-anchor-k {
  font-size: 9px;
  font-weight: 700;
  color: var(--t3);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.kp-anchor-name {
  font-size: 13px;
  font-weight: 750;
  color: var(--t1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.kp-use {
  border: 1px dashed var(--border-strong);
  background: transparent;
  color: var(--accent);
  border-radius: var(--r-pill);
  padding: 3px 9px;
  font-family: var(--font);
  font-size: 10.5px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  margin-left: auto;
}
.kp-hint {
  font-size: 11px;
  color: var(--t3);
}

.kp-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  min-height: 0;
  margin: 0 -4px;
  padding: 0 4px 2px;
  animation: cp-row-in 0.36s var(--ease-out);
}

/* The big eye toggle */
.kp-eye {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 11px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--elevated);
  color: var(--t1);
  font-family: var(--font);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.25s ease,
    background 0.25s ease,
    box-shadow 0.25s ease;
}
.kp-eye:disabled {
  opacity: 0.5;
  cursor: default;
}
.kp-eye.on {
  border-color: color-mix(in srgb, var(--accent) 55%, transparent);
  background: color-mix(in srgb, var(--accent) 14%, var(--elevated));
  box-shadow: 0 0 22px color-mix(in srgb, var(--accent) 22%, transparent);
}
.kp-eye-ic {
  position: relative;
  width: 30px;
  height: 18px;
  border-radius: 50% / 50%;
  border: 2px solid var(--t2);
  display: grid;
  place-items: center;
  flex-shrink: 0;
  transition: border-color 0.25s ease;
  overflow: hidden;
}
.kp-eye-iris {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--t2);
  transform: scaleY(0.15);
  transition:
    transform 0.4s var(--ease-spring),
    background 0.25s ease;
}
.kp-eye.on .kp-eye-ic {
  border-color: var(--accent);
}
.kp-eye.on .kp-eye-iris {
  background: var(--accent);
  transform: scaleY(1);
  animation: kp-look 4s ease-in-out 0.5s infinite;
}
@keyframes kp-look {
  0%,
  100% {
    translate: 0 0;
  }
  30% {
    translate: -5px 0;
  }
  60% {
    translate: 5px 0;
  }
}
.kp-eye-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.kp-eye-text b {
  font-size: 12px;
}
.kp-eye-text small {
  font-size: 10px;
  color: var(--t3);
}

.kp-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  transition: opacity 0.2s ease;
}
.kp-filter.dim {
  opacity: 0.5;
}
.kp-chip {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--t2);
  border-radius: var(--r-pill);
  padding: 2px 9px;
  font-family: var(--font);
  font-size: 10.5px;
  font-weight: 650;
  cursor: pointer;
  transition:
    background 0.2s ease,
    color 0.2s ease,
    border-color 0.2s ease;
}
.kp-chip.on {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--on-accent);
}

.kp-legend {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.kp-leg-row {
  display: grid;
  grid-template-columns: 10px 1fr auto 54px;
  align-items: center;
  gap: 7px;
  font-size: 11px;
  color: var(--t2);
}
.kp-leg-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--kc);
  box-shadow: 0 0 6px var(--kc);
}
.kp-leg-count {
  font-weight: 700;
  color: var(--t1);
  font-variant-numeric: tabular-nums;
}
.kp-leg-bar {
  height: 4px;
  border-radius: 2px;
  background: var(--elevated);
  overflow: hidden;
}
.kp-leg-bar span {
  display: block;
  height: 100%;
  background: var(--kc);
  border-radius: 2px;
  transition: width 0.5s var(--ease-out);
}

.kp-sub {
  font-size: 9.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--t3);
  margin-top: 2px;
}
.kp-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.kp-row {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 4px 7px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--t1);
  font-family: var(--font);
  font-size: 11.5px;
  cursor: pointer;
  text-align: left;
  transition:
    background 0.15s ease,
    transform 0.2s var(--ease-spring);
}
.kp-row:hover {
  background: var(--hover);
  transform: translateX(2px);
}
.kp-row-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--kc);
  flex-shrink: 0;
}
.kp-row-name {
  font-weight: 650;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.kp-row-rel {
  margin-left: auto;
  font-size: 10.5px;
  font-weight: 700;
  color: var(--kc);
  white-space: nowrap;
}
.kp-row-meter {
  flex: 1;
  min-width: 24px;
  height: 3px;
  border-radius: 2px;
  background: var(--elevated);
  overflow: hidden;
}
.kp-row-meter span {
  display: block;
  height: 100%;
  background: var(--accent);
}

/* Walker */
.kp-walk-grid {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.kp-walk-row {
  display: grid;
  grid-template-columns: 52px repeat(3, 1fr);
  gap: 4px;
  align-items: center;
}
.kp-walk-label {
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--t3);
}
.kp-tok {
  border: 1px solid var(--border);
  background: var(--elevated);
  color: var(--t1);
  border-radius: 8px;
  padding: 4px 2px;
  font-family: var(--font);
  font-size: 10.5px;
  font-weight: 650;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition:
    transform 0.18s var(--ease-spring),
    border-color 0.18s ease;
}
.kp-tok:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: var(--accent);
}
.kp-tok:disabled {
  opacity: 0.4;
  cursor: default;
}
.kp-chain {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  min-height: 30px;
  padding: 5px 6px;
  border-radius: 10px;
  border: 1px dashed var(--border-strong);
}
.kp-chain-tok {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  border: none;
  border-radius: var(--r-pill);
  padding: 2px 5px 2px 9px;
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  color: var(--t1);
  font-family: var(--font);
  font-size: 10.5px;
  font-weight: 700;
  cursor: pointer;
}
.kp-chain-tok + .kp-chain-tok::before {
  content: '›';
  margin: 0 3px 0 -6px;
  color: var(--t3);
}
.kp-chain-x {
  opacity: 0.5;
  font-size: 11px;
}
.kp-clear {
  margin-left: auto;
  border: none;
  background: transparent;
  color: var(--t3);
  cursor: pointer;
  font-size: 12px;
}
.kp-phrase {
  font-size: 12px;
  font-style: italic;
  color: var(--t2);
}
.tok-enter-active {
  transition:
    transform 0.34s var(--ease-spring),
    opacity 0.2s ease;
}
.tok-leave-active {
  transition:
    transform 0.2s ease,
    opacity 0.18s ease;
  position: absolute;
}
.tok-enter-from,
.tok-leave-to {
  opacity: 0;
  transform: scale(0.4);
}
.tok-move {
  transition: transform 0.3s var(--ease-out);
}

/* Insights */
.kp-stat-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}
.kp-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 7px 0 6px;
  border-radius: 10px;
  background: var(--elevated);
  animation: cp-row-in 0.44s var(--ease-out) backwards;
  animation-delay: calc(var(--i) * 0.06s);
}
.kp-stat b {
  font-size: 17px;
  font-weight: 800;
  color: var(--t1);
  font-variant-numeric: tabular-nums;
}
.kp-stat span {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--t3);
}
.kp-islands {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 4px 2px;
}
.kp-isl {
  width: var(--s);
  height: var(--s);
  border-radius: 50%;
  background: radial-gradient(
    circle at 35% 30%,
    var(--kin-social),
    color-mix(in srgb, var(--kin-social) 40%, transparent)
  );
  cursor: pointer;
  transition: transform 0.2s var(--ease-spring);
  animation: cp-row-in 0.44s var(--ease-out) backwards;
}
.kp-isl:hover {
  transform: scale(1.2);
}

/* ── 水墨 ink theme: kin names are brushed; chips and tabs are cut paper ── */
:root[data-theme='ink'] .kp-title {
  font-family: var(--font-brush);
  font-size: 17px;
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0.02em;
  color: var(--t1);
}
:root[data-theme='ink'] .kp-title-ic,
:root[data-theme='ink'] .kp-eye-ic {
  filter: grayscale(1) sepia(0.4);
}
:root[data-theme='ink'] .kp-quiz,
:root[data-theme='ink'] .kp-tabs,
:root[data-theme='ink'] .kp-tab,
:root[data-theme='ink'] .kp-tab-thumb,
:root[data-theme='ink'] .kp-chip,
:root[data-theme='ink'] .kp-use,
:root[data-theme='ink'] .kp-eye,
:root[data-theme='ink'] .kp-tok,
:root[data-theme='ink'] .kp-chain-tok,
:root[data-theme='ink'] .kp-isl,
:root[data-theme='ink'] .kp-clear {
  border-radius: 3px 5px 4px 6px / 5px 3px 6px 4px;
  font-family: var(--font-ink-label);
}
:root[data-theme='ink'] .kp-avatar {
  border-radius: 3px 5px 2px 6px / 5px 2px 6px 3px;
}
:root[data-theme='ink'] .kp-anchor-name,
:root[data-theme='ink'] .kp-row-name {
  font-family: var(--font-brush);
  font-size: 15.5px;
  font-weight: 400;
}
:root[data-theme='ink'] .kp-row-rel,
:root[data-theme='ink'] .kp-phrase {
  font-family: var(--font-brush);
  font-weight: 400;
  font-size: 14px;
}
:root[data-theme='ink'] .kp-leg-dot,
:root[data-theme='ink'] .kp-row-dot {
  border-radius: 46% 54% 40% 60% / 55% 42% 58% 45%;
}
:root[data-theme='ink'] .kp-stat b {
  font-family: var(--font-brush);
  font-weight: 400;
}
</style>
