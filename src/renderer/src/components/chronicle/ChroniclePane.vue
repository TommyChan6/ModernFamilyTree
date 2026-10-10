<template>
  <!-- The Chronicle pane: the project's eras and story events, as lists you can
       jump through, plus era preset packs. Lives in the Timeline's pane stack
       (and the graph's, for the Birth layout). -->
  <div class="chp canvas-pane" @pointerdown.stop @wheel.stop @click.stop>
    <div class="chp-head">
      <span class="chp-title">
        <UiIcon class="chp-title-ic" name="scroll-text" :size="14" />Chronicle
      </span>
      <button class="chp-new" title="New era" @click="newEra">
        <UiIcon name="plus" :size="14" />Era
      </button>
      <button class="chp-new chp-new-ev" title="New event" @click="newEvent">
        <UiIcon name="plus" :size="14" />Event
      </button>
    </div>

    <div class="chp-tabs" role="tablist">
      <span
        class="chp-thumb"
        :style="{ transform: `translateX(${tab === 'events' ? 100 : 0}%)` }"
      ></span>
      <button class="chp-tab" :class="{ on: tab === 'eras' }" @click="tab = 'eras'">
        Eras <b>{{ store.eras.length }}</b>
      </button>
      <button class="chp-tab" :class="{ on: tab === 'events' }" @click="tab = 'events'">
        Events <b>{{ store.events.length }}</b>
      </button>
    </div>

    <!-- ── Eras ── -->
    <div v-if="tab === 'eras'" class="chp-body">
      <div class="chp-presets">
        <span class="chp-sub">Quick start</span>
        <div class="chp-pack-row">
          <button
            v-for="(p, i) in ERA_PACKS"
            :key="p.id"
            class="chp-pack"
            :style="{ '--i': i }"
            :title="p.hint"
            @click="applyPack(p)"
          >
            <UiIcon class="chp-pack-ic" :name="p.icon" :size="14" />{{ p.label }}
          </button>
        </div>
      </div>
      <div v-if="!eraRows.length" class="chp-empty">
        <UiIcon class="chp-empty-ic" name="hourglass" :size="24" :stroke="1.7" />
        Name the stretches of your story — a war, a reign, a golden age — and they'll band the
        Timeline and the Birth graph.
      </div>
      <div class="chp-list">
        <div
          v-for="(e, i) in eraRows"
          :key="e.id"
          class="chp-era cp-stagger"
          :style="{ '--i': i, '--c': e.color }"
          @click="$emit('jump', e.jumpYear)"
        >
          <UiIcon class="chp-era-ic" :name="hasIcon(e.icon) ? e.icon : 'diamond'" :size="16" />
          <span class="chp-era-text">
            <span class="chp-era-name">{{ e.name }}</span>
            <span class="chp-era-span">{{ e.span }}</span>
            <span class="chp-era-bar">
              <span :style="{ left: e.l + '%', width: e.w + '%' }"></span>
            </span>
          </span>
          <button
            class="chp-edit"
            title="Edit era"
            aria-label="Edit era"
            @click.stop="store.openEraEditor({ id: e.id })"
          >
            <UiIcon name="pencil" :size="14" />
          </button>
        </div>
      </div>
    </div>

    <!-- ── Events ── -->
    <div v-else class="chp-body">
      <SearchField
        v-if="store.events.length > 5"
        v-model="q"
        size="sm"
        placeholder="Search events…"
      />
      <div v-if="!eventRows.length" class="chp-empty">
        <UiIcon class="chp-empty-ic" name="swords" :size="24" :stroke="1.7" />
        {{
          store.events.length
            ? 'Nothing matches.'
            : 'Battles, coronations, migrations, first meetings — add the moments that shaped your people.'
        }}
      </div>
      <div class="chp-list">
        <div
          v-for="(ev, i) in eventRows"
          :key="ev.id"
          class="chp-ev cp-stagger"
          :style="{ '--i': i, '--c': ev.color }"
          @click="$emit('jump', ev.year)"
          @pointerenter="$emit('hover', ev.id)"
          @pointerleave="$emit('hover', null)"
        >
          <span class="chp-ev-disc"><UiIcon :name="ev.icon" :size="14" /></span>
          <span class="chp-ev-text">
            <span class="chp-ev-title" :class="'imp-' + ev.importance">{{ ev.title }}</span>
            <span class="chp-ev-meta">
              {{ ev.when }}<template v-if="ev.cast"> · {{ ev.cast }}</template>
            </span>
          </span>
          <button
            class="chp-edit"
            title="Edit event"
            aria-label="Edit event"
            @click.stop="store.openEventEditor({ id: ev.id })"
          >
            <UiIcon name="pencil" :size="14" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useMainStore } from '../../store/index.js'
import { ERA_PACKS, presetEras, eventKind } from '../../../../shared/chronicle'
import { toOrdinal, format } from '../../../../shared/calendarMath'
import { chronicleRange } from './chronicleModel.js'
import { toast } from '../../lib/dialogs.js'
import { undoToast } from '../../lib/undoToast.js'
import { useKinship } from '../kinship/useKinship'
import UiIcon from '../ui/UiIcon.js'
import SearchField from '../ui/SearchField.vue'
import { hasIcon } from '../ui/icons.js'

defineEmits(['jump', 'hover'])
const store = useMainStore()
const kin = useKinship()
const tab = ref('eras')
const q = ref('')

const refYear = computed(() => store.currentDate?.year ?? new Date().getFullYear())
const range = computed(() => chronicleRange(store.persons, store.eras, store.events, refYear.value))

const eraRows = computed(() => {
  const { min, max } = range.value
  const span = Math.max(1, max - min)
  return [...store.eras]
    .map((e) => {
      const a = toOrdinal(e.start)
      const b = toOrdinal(e.end)
      const l = Math.max(0, Math.min(100, (((a ?? min) - min) / span) * 100))
      const r = Math.max(0, Math.min(100, (((b ?? max) - min) / span) * 100))
      return {
        ...e,
        sort: a ?? -Infinity,
        span: `${format(e.start) || '…'} – ${format(e.end) || 'now'}`,
        l,
        w: Math.max(2, r - l),
        jumpYear: a ?? min
      }
    })
    .sort((x, y) => x.sort - y.sort)
})

const eventRows = computed(() => {
  const needle = q.value.trim().toLowerCase()
  return [...store.events]
    .filter(
      (ev) =>
        !needle ||
        ev.title.toLowerCase().includes(needle) ||
        ev.place?.toLowerCase().includes(needle)
    )
    .map((ev) => {
      const k = eventKind(ev.kind)
      const names = ev.person_ids.map((id) => kin.personName(id).split(' ')[0])
      return {
        id: ev.id,
        title: ev.title,
        icon: hasIcon(ev.icon) ? ev.icon : k.icon,
        color: ev.color || k.color,
        importance: ev.importance,
        year: toOrdinal(ev.date),
        when: format(ev.date)
          ? format(ev.end)
            ? `${format(ev.date)}–${format(ev.end)}`
            : format(ev.date)
          : 'undated',
        cast:
          names.length > 3
            ? `${names.slice(0, 2).join(', ')} +${names.length - 2}`
            : names.join(', ')
      }
    })
    .sort((x, y) => (x.year ?? Infinity) - (y.year ?? Infinity))
})

function newEra() {
  store.openEraEditor({
    start: {
      year: range.value.min,
      month: null,
      day: null,
      precision: 'year',
      calendar: 'gregorian'
    }
  })
}
function newEvent() {
  const sel = store.selectedPersonId
  store.openEventEditor(sel ? { person_ids: [sel] } : {})
  tab.value = 'events'
}

async function applyPack(p) {
  const { min, max } = range.value
  const have = new Set(store.eras.map((e) => e.name.toLowerCase()))
  const seeds = presetEras(p.id, min, max).filter((s) => !have.has(s.name.toLowerCase()))
  if (!seeds.length) {
    toast(`Nothing new from “${p.label}” for ${min}–${max}`)
    return
  }
  const res = await store.saveEras(seeds)
  if (res.success)
    undoToast(`Added ${seeds.length} era${seeds.length > 1 ? 's' : ''}`, 'eras:saveMany')
  else toast(res.error || 'Could not add the eras', { tone: 'danger' })
}
</script>

<style scoped>
.chp {
  width: 272px;
  padding: 12px 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 9px;
  max-height: calc(100vh - 230px);
  overflow: hidden;
}
.chp-head {
  display: flex;
  align-items: center;
  gap: 5px;
}
.chp-title {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: var(--t3);
  margin-right: auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.chp-title-ic {
  animation: chp-unroll 4s ease-in-out infinite;
}
@keyframes chp-unroll {
  50% {
    transform: rotate(-12deg) scale(1.1);
  }
}
.chp-new {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: var(--ctl-xs);
  border: 1px solid var(--border);
  background: var(--elevated);
  color: var(--t1);
  border-radius: var(--r-pill);
  padding: 0 10px 0 7px;
  font-family: var(--font);
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.2s var(--ease-spring);
}
.chp-new:hover {
  transform: translateY(-1px);
}
.chp-new-ev {
  background: rgba(var(--accent-rgb), 0.16);
  border-color: rgba(var(--accent-rgb), 0.45);
}
.chp-tabs {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  padding: 3px;
  border-radius: 10px;
  background: var(--elevated);
}
.chp-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: calc(50% - 3px);
  height: calc(100% - 6px);
  border-radius: 8px;
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  transition: transform 0.34s var(--ease-spring);
}
.chp-tab {
  position: relative;
  z-index: 1;
  border: none;
  background: transparent;
  color: var(--t3);
  font-family: var(--font);
  font-size: 12px;
  font-weight: 700;
  padding: 5px 0;
  cursor: pointer;
}
.chp-tab b {
  margin-left: 3px;
  color: var(--accent);
}
.chp-tab.on {
  color: var(--t1);
}
.chp-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  overflow-y: auto;
  margin: 0 -4px;
  padding: 0 4px 2px;
  animation: cp-row-in 0.36s var(--ease-out);
}
.chp-sub {
  font-size: var(--fs-xs);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--t3);
}
.chp-presets {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.chp-pack-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.chp-pack {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px dashed var(--border-strong);
  background: transparent;
  color: var(--t2);
  border-radius: var(--r-pill);
  height: var(--ctl-xs);
  padding: 0 10px 0 8px;
  font-family: var(--font);
  font-size: 11.5px;
  font-weight: 650;
  cursor: pointer;
  animation: cp-row-in 0.4s var(--ease-out) backwards;
  animation-delay: calc(var(--i) * 0.04s);
  transition:
    border-color var(--dur) ease,
    color var(--dur) ease;
}
.chp-pack:hover {
  border-color: var(--accent);
  color: var(--t1);
}
.chp-pack-ic {
  flex-shrink: 0;
}
.chp-empty {
  font-size: 12.5px;
  color: var(--t3);
  line-height: 1.45;
  text-align: center;
  padding: 8px 6px;
}
.chp-empty-ic {
  display: block;
  margin: 0 auto 6px;
}
.chp-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.chp-era,
.chp-ev {
  --c: var(--accent);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 7px;
  border-radius: 10px;
  cursor: pointer;
  transition:
    background 0.15s ease,
    transform 0.2s var(--ease-spring);
}
.chp-era:hover,
.chp-ev:hover {
  background: var(--hover);
  transform: translateX(2px);
}
.chp-era {
  border-left: 3px solid var(--c);
}
.chp-era-ic {
  flex-shrink: 0;
  margin: 0 3px;
  color: var(--c);
}
.chp-era-text,
.chp-ev-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.chp-era-name,
.chp-ev-title {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--t1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.chp-ev-title.imp-3 {
  font-weight: 850;
}
.chp-ev-title.imp-1 {
  font-weight: 550;
  color: var(--t2);
}
.chp-era-span,
.chp-ev-meta {
  font-size: 11px;
  color: var(--t3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.chp-era-bar {
  position: relative;
  height: 3px;
  margin-top: 3px;
  border-radius: 2px;
  background: var(--elevated);
  overflow: hidden;
}
.chp-era-bar span {
  position: absolute;
  top: 0;
  bottom: 0;
  border-radius: 2px;
  background: var(--c);
  animation: chp-grow 0.7s var(--ease-out) backwards;
  transform-origin: left;
}
@keyframes chp-grow {
  from {
    transform: scaleX(0);
  }
}
.chp-ev-disc {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--t1);
  background: color-mix(in srgb, var(--c) 22%, transparent);
  box-shadow: 0 0 0 1.5px color-mix(in srgb, var(--c) 70%, transparent);
  flex-shrink: 0;
}
.chp-edit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: var(--ctl-xs);
  height: var(--ctl-xs);
  padding: 0;
  border: none;
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--t3);
  cursor: pointer;
  opacity: 0;
  transition:
    opacity 0.15s ease,
    color 0.15s ease;
}
.chp-edit:hover {
  color: var(--t1);
}
.chp-era:hover .chp-edit,
.chp-ev:hover .chp-edit,
.chp-edit:focus-visible {
  opacity: 1;
}
</style>
