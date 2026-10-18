<template>
  <aside class="mi" @pointerdown.stop @wheel.stop @keydown.stop="onKey">
    <!-- ── a feature ─────────────────────────────────────────────────────── -->
    <template v-if="feature">
      <header class="mi-head">
        <span class="mi-kind-icon"><UiIcon :name="kindIcon" :size="22" /></span>
        <div class="mi-head-text">
          <div class="mi-kicker">{{ t('map.kinds.' + feature.kind) }}</div>
          <input
            ref="nameEl"
            class="mi-name"
            :value="feature.name || ''"
            :placeholder="t('map.inspector.namePh')"
            @input="patch({ name: $event.target.value }, 'name')"
          />
          <div v-if="measureText" class="mi-measure">
            <UiIcon name="ruler" :size="12" />
            {{ measureText }}
          </div>
        </div>
        <button
          class="mi-x"
          :title="t('map.inspector.close')"
          :aria-label="t('map.inspector.close')"
          @click="emit('close')"
        >
          <UiIcon name="x" :size="16" />
        </button>
      </header>

      <section v-if="sameGeometry.length > 1" class="mi-sec">
        <div class="mi-label">{{ t('map.inspector.type') }}</div>
        <div class="mi-chips">
          <button
            v-for="k in sameGeometry"
            :key="k.id"
            class="mi-chip"
            :class="{ on: feature.kind === k.id }"
            @click="patch({ kind: k.id })"
          >
            <UiIcon :name="k.icon" :size="14" />
            {{ t('map.kinds.' + k.id) }}
          </button>
        </div>
      </section>

      <section v-if="glyphs.length" class="mi-sec">
        <div class="mi-label">{{ t('map.inspector.icon') }}</div>
        <div class="mi-glyphs">
          <button
            v-for="g in glyphs"
            :key="g.glyph"
            class="mi-glyph"
            :class="{ on: feature.icon === g.glyph }"
            :title="t('map.tools.' + g.id.replace(':', '_'))"
            :aria-label="t('map.tools.' + g.id.replace(':', '_'))"
            @click="patch({ icon: g.glyph })"
          >
            <UiIcon :name="g.icon" :size="16" />
          </button>
        </div>
      </section>

      <section v-if="feature.kind === 'territory'" class="mi-sec">
        <div class="mi-label">{{ t('map.inspector.group') }}</div>
        <select
          class="mi-select"
          :value="feature.tag_id || ''"
          @change="onTag($event.target.value)"
        >
          <option value="">{{ t('map.inspector.noGroup') }}</option>
          <option v-for="tg in tags" :key="tg.id" :value="tg.id">{{ tg.label }}</option>
        </select>
        <p class="mi-hint">{{ t('map.inspector.groupHint') }}</p>
      </section>

      <section class="mi-sec">
        <div class="mi-label">{{ t('map.inspector.color') }}</div>
        <div class="mi-swatches">
          <button
            class="mi-swatch mi-swatch-auto"
            :class="{ on: !feature.color }"
            :title="t('map.inspector.styleColor')"
            :aria-label="t('map.inspector.styleColor')"
            @click="patch({ color: '' })"
          >
            <UiIcon name="sparkles" :size="12" />
          </button>
          <button
            v-for="c in SWATCHES"
            :key="c"
            class="mi-swatch"
            :class="{ on: feature.color === c }"
            :style="{ background: c }"
            @click="patch({ color: c })"
          ></button>
          <label class="mi-swatch mi-swatch-custom" :title="t('map.inspector.custom')">
            <input
              type="color"
              :value="feature.color || '#888888'"
              @input="patch({ color: $event.target.value }, 'color')"
            />
            <UiIcon name="plus" :size="12" />
          </label>
        </div>
      </section>

      <section v-if="feature.kind !== 'land' && feature.kind !== 'water'" class="mi-sec">
        <div class="mi-label">
          {{ t('map.inspector.size') }}
          <span class="mi-val">{{ (feature.size || 1).toFixed(1) }}×</span>
        </div>
        <input
          class="mi-range"
          type="range"
          min="0.3"
          max="4"
          step="0.1"
          :value="feature.size || 1"
          @input="patch({ size: +$event.target.value }, 'size')"
        />
      </section>

      <section v-if="feature.kind === 'label'" class="mi-sec">
        <div class="mi-label">
          {{ t('map.inspector.rotate') }}
          <span class="mi-val">{{ Math.round(((feature.rot || 0) * 180) / Math.PI) }}°</span>
        </div>
        <input
          class="mi-range"
          type="range"
          min="-90"
          max="90"
          step="1"
          :value="Math.round(((feature.rot || 0) * 180) / Math.PI)"
          @input="patch({ rot: (+$event.target.value * Math.PI) / 180 }, 'rot')"
        />
      </section>

      <section class="mi-sec">
        <div class="mi-label">{{ t('map.inspector.when') }}</div>
        <div class="mi-when">
          <label class="mi-when-field">
            <span>{{ t('map.inspector.from') }}</span>
            <input
              type="number"
              :value="feature.from ?? ''"
              :placeholder="t('map.inspector.always')"
              @change="onYear('from', $event.target.value)"
            />
          </label>
          <UiIcon class="mi-when-dash" name="arrow-right" :size="14" />
          <label class="mi-when-field">
            <span>{{ t('map.inspector.to') }}</span>
            <input
              type="number"
              :value="feature.to ?? ''"
              :placeholder="t('map.inspector.always')"
              @change="onYear('to', $event.target.value)"
            />
          </label>
        </div>
        <div class="mi-row">
          <button class="mi-mini" @click="patch({ from: Math.round(year) })">
            <UiIcon name="clock" :size="14" />
            {{ t('map.inspector.fromNow', { y: Math.round(year) }) }}
          </button>
          <button class="mi-mini" @click="patch({ to: Math.round(year) })">
            <UiIcon name="clock" :size="14" />
            {{ t('map.inspector.untilNow', { y: Math.round(year) }) }}
          </button>
          <button
            v-if="feature.from != null || feature.to != null"
            class="mi-mini"
            :title="t('map.inspector.always')"
            :aria-label="t('map.inspector.always')"
            @click="patch({ from: null, to: null })"
          >
            <UiIcon name="infinity" :size="14" />
          </button>
        </div>
        <p class="mi-hint">{{ t('map.inspector.whenHint') }}</p>
      </section>

      <section class="mi-sec">
        <div class="mi-label">{{ t('map.inspector.notes') }}</div>
        <textarea
          class="mi-notes"
          rows="3"
          :value="feature.note || ''"
          :placeholder="t('map.inspector.notesPh')"
          @input="patch({ note: $event.target.value }, 'note')"
        ></textarea>
      </section>

      <footer class="mi-actions">
        <button
          class="mi-act"
          :title="t('map.inspector.duplicate')"
          :aria-label="t('map.inspector.duplicate')"
          @click="emit('duplicate')"
        >
          <UiIcon name="copy" :size="16" />
        </button>
        <button
          class="mi-act"
          :title="t('map.inspector.front')"
          :aria-label="t('map.inspector.front')"
          @click="emit('order', 1)"
        >
          <UiIcon name="arrow-up" :size="16" />
        </button>
        <button
          class="mi-act"
          :title="t('map.inspector.back')"
          :aria-label="t('map.inspector.back')"
          @click="emit('order', -1)"
        >
          <UiIcon name="arrow-down" :size="16" />
        </button>
        <button
          v-if="geometry === 'area' || geometry === 'line'"
          class="mi-act mi-act-wide mi-act-era"
          :title="t('map.inspector.newEraHint')"
          @click="emit('fork-era')"
        >
          <UiIcon name="scissors" :size="16" />
          <span class="mi-act-text">{{ t('map.inspector.newEra', { y: Math.round(year) }) }}</span>
        </button>
        <button
          class="mi-act mi-danger"
          :title="t('map.inspector.delete')"
          :aria-label="t('map.inspector.delete')"
          @click="emit('delete')"
        >
          <UiIcon name="trash-2" :size="16" />
        </button>
      </footer>
    </template>

    <!-- ── a person on the map ───────────────────────────────────────────── -->
    <template v-else-if="token">
      <header class="mi-head">
        <span class="mi-avatar" :style="{ background: token.color }">
          <img v-if="token.imgUrl" :src="token.imgUrl" alt="" />
          <span v-else>{{ token.initial }}</span>
        </span>
        <div class="mi-head-text">
          <div class="mi-kicker">{{ t('map.inspector.onMap') }}</div>
          <div class="mi-person">{{ token.name }}</div>
          <div v-if="token.life" class="mi-life">{{ token.life }}</div>
        </div>
        <button
          class="mi-x"
          :title="t('map.inspector.close')"
          :aria-label="t('map.inspector.close')"
          @click="emit('close')"
        >
          <UiIcon name="x" :size="16" />
        </button>
      </header>

      <section class="mi-sec">
        <div class="mi-label">
          {{ t('map.inspector.journey') }} <span class="mi-val">{{ token.keys.length }}</span>
        </div>
        <TransitionGroup name="mi-stop" tag="div" class="mi-stops">
          <div
            v-for="(k, i) in token.keys"
            :key="k.t + ':' + i"
            class="mi-stop"
            :class="{ here: isHere(i) }"
          >
            <span class="mi-stop-dot"></span>
            <input
              class="mi-stop-year"
              type="number"
              :value="k.t"
              @change="onStopYear(i, $event.target.value)"
            />
            <input
              class="mi-stop-note"
              :value="k.note || ''"
              :placeholder="t('map.inspector.stopNotePh')"
              @input="onStopNote(i, $event.target.value)"
            />
            <button
              class="mi-stop-go"
              :title="t('map.inspector.goTo')"
              :aria-label="t('map.inspector.goTo')"
              @click="emit('goto-stop', k)"
            >
              <UiIcon name="arrow-right" :size="14" />
            </button>
            <button
              v-if="token.keys.length > 1"
              class="mi-stop-x"
              :title="t('map.inspector.removeStop')"
              :aria-label="t('map.inspector.removeStop')"
              @click="onStopRemove(i)"
            >
              <UiIcon name="x" :size="14" />
            </button>
          </div>
        </TransitionGroup>
        <p class="mi-hint">{{ t('map.inspector.journeyHint') }}</p>
      </section>

      <footer class="mi-actions">
        <button class="mi-act mi-act-wide" :class="{ on: following }" @click="emit('follow')">
          <UiIcon name="video" :size="16" />
          <span class="mi-act-text">{{
            following ? t('map.inspector.following') : t('map.inspector.follow')
          }}</span>
        </button>
        <button class="mi-act mi-act-wide" @click="emit('open-person')">
          <UiIcon name="user" :size="16" />
          <span class="mi-act-text">{{ t('map.inspector.profile') }}</span>
        </button>
        <button
          class="mi-act mi-danger"
          :title="t('map.inspector.removeFromMap')"
          :aria-label="t('map.inspector.removeFromMap')"
          @click="emit('token-remove')"
        >
          <UiIcon name="trash-2" :size="16" />
        </button>
      </footer>
    </template>
  </aside>
</template>

<script setup>
import { computed, ref, nextTick } from 'vue'
import { useI18n } from '../../i18n'
import { ALL_TOOLS, MAP_KIND_GEOMETRY, TOOL_BY_ID } from './mapKinds'
import UiIcon from '../ui/UiIcon.js'

// The right-hand inspector for whatever is selected on the map: a feature
// (name, type, icon, color, size, time window, group link, notes) or a
// person token (their journey's stops). Pure UI — every change goes up as an
// event; MapView applies it (with undo coalescing on the `key`).
const props = defineProps({
  feature: { type: Object, default: null },
  token: { type: Object, default: null },
  year: { type: Number, required: true },
  tags: { type: Array, default: () => [] },
  following: { type: Boolean, default: false },
  /** The selection's length / area in the map style's unit (ready-translated). */
  measureText: { type: String, default: '' }
})
const emit = defineEmits([
  'patch',
  'close',
  'delete',
  'duplicate',
  'order',
  'fork-era',
  'token-keys',
  'token-remove',
  'open-person',
  'follow',
  'goto-stop'
])
const { t } = useI18n()
const nameEl = ref(null)

const SWATCHES = [
  '#c0392b',
  '#e67e22',
  '#f1c40f',
  '#27ae60',
  '#16a085',
  '#2e86de',
  '#8e44ad',
  '#d35493',
  '#7f5539',
  '#34495e',
  '#ecf0f1',
  '#111111'
]

const geometry = computed(() => (props.feature ? MAP_KIND_GEOMETRY[props.feature.kind] : null))
const kindIcon = computed(() => {
  const f = props.feature
  if (!f) return ''
  const byGlyph = f.icon && ALL_TOOLS.find((tl) => tl.glyph === f.icon)
  return byGlyph?.icon || TOOL_BY_ID.get(f.kind)?.icon || 'map-pin'
})
/** Kinds the selection can switch to without redrawing (same geometry). */
const sameGeometry = computed(() => {
  const f = props.feature
  if (!f) return []
  const geo = MAP_KIND_GEOMETRY[f.kind]
  if (geo === 'point') return []
  return Object.keys(MAP_KIND_GEOMETRY)
    .filter((k) => MAP_KIND_GEOMETRY[k] === geo)
    .map((k) => ({ id: k, icon: TOOL_BY_ID.get(k)?.icon || 'dot' }))
})
const glyphs = computed(() => {
  const f = props.feature
  if (!f || (f.kind !== 'place' && f.kind !== 'event')) return []
  return ALL_TOOLS.filter((tl) => tl.id.startsWith(f.kind + ':'))
})

function patch(fields, key) {
  emit('patch', fields, key)
}
function onYear(field, raw) {
  const v = raw === '' ? null : parseInt(raw)
  patch({ [field]: Number.isFinite(v) ? v : null })
}
function onTag(id) {
  const tag = props.tags.find((tg) => tg.id === id)
  const fields = { tag_id: id || null }
  // adopt the group's name + color when the territory has none of its own
  if (tag && !props.feature.name) fields.name = tag.label
  if (tag && tag.color) fields.color = ''
  patch(fields)
}

function isHere(i) {
  const keys = props.token.keys
  const y = props.year
  if (y < keys[0].t) return i === 0
  for (let j = keys.length - 1; j >= 0; j--) if (keys[j].t <= y) return j === i
  return false
}
function onStopYear(i, raw) {
  const v = parseInt(raw)
  if (!Number.isFinite(v)) return
  // one stop per year: moving a stop onto another's year replaces that one
  const keys = props.token.keys.map((k) => ({ ...k }))
  keys[i].t = v
  emit(
    'token-keys',
    keys.filter((k, j) => j === i || k.t !== v)
  )
}
function onStopNote(i, note) {
  const keys = props.token.keys.map((k) => ({ ...k }))
  keys[i].note = note
  emit('token-keys', keys, 'note' + i)
}
function onStopRemove(i) {
  const keys = props.token.keys.filter((_, j) => j !== i).map((k) => ({ ...k }))
  emit('token-keys', keys)
}

/** Esc / Enter leave a field, so the map's hotkeys work again right away
 *  (Enter in the notes box still makes a new line). */
function onKey(e) {
  const el = e.target
  if (!el || !('blur' in el) || el.tagName === 'BUTTON') return
  if (e.key === 'Escape' || (e.key === 'Enter' && el.tagName !== 'TEXTAREA')) el.blur()
}

async function focusName() {
  await nextTick()
  nameEl.value?.focus()
  nameEl.value?.select()
}
defineExpose({ focusName })
</script>

<style scoped>
.mi-measure {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 3px;
  font-size: var(--fs-xs);
  color: var(--t3);
  font-variant-numeric: tabular-nums;
}
.mi {
  position: absolute;
  right: 14px;
  top: 14px;
  bottom: 88px;
  width: 290px;
  overflow-y: auto;
  padding: 14px;
  background: var(--glass-soft);
  backdrop-filter: blur(16px) saturate(1.3);
  -webkit-backdrop-filter: blur(16px) saturate(1.3);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow);
  z-index: 9;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.mi-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.mi-kind-icon {
  color: var(--t1);
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  background: var(--elevated);
  border-radius: 12px;
  flex: 0 0 auto;
  animation: mi-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes mi-pop {
  from {
    transform: scale(0.4) rotate(-20deg);
    opacity: 0;
  }
}
.mi-avatar {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  overflow: hidden;
  display: grid;
  place-items: center;
  color: #fff;
  font-weight: 800;
  font-size: 18px;
  flex: 0 0 auto;
  box-shadow: 0 0 0 3px var(--surface);
  animation: mi-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.mi-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.mi-head-text {
  flex: 1;
  min-width: 0;
}
.mi-kicker {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  color: var(--t3);
}
.mi-name {
  width: 100%;
  border: none;
  border-bottom: 1.5px solid var(--border);
  background: transparent;
  color: var(--t1);
  font-size: 16px;
  font-weight: 700;
  font-family: var(--font);
  padding: 2px 0;
  outline: none;
  transition: border-color 0.15s;
}
.mi-name:focus {
  border-color: var(--accent);
}
.mi-person {
  font-size: 16px;
  font-weight: 700;
  color: var(--t1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mi-life {
  font-size: 12.5px;
  color: var(--t2);
}
.mi-x {
  border: none;
  background: transparent;
  color: var(--t3);
  cursor: pointer;
  width: var(--ctl-sm);
  height: var(--ctl-sm);
  padding: 0;
  border-radius: 7px;
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}
.mi-x:hover {
  background: var(--hover);
  color: var(--t1);
}
.mi-sec {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.mi-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--t2);
  display: flex;
  justify-content: space-between;
}
.mi-val {
  color: var(--t3);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.mi-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.mi-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: var(--ctl-xs);
  border: 1px solid var(--border);
  background: var(--elevated);
  color: var(--t1);
  border-radius: 999px;
  padding: 3px 9px;
  font-size: 12.5px;
  font-family: var(--font);
  cursor: pointer;
  transition:
    background 0.12s,
    border-color 0.12s;
}
.mi-chip:hover {
  background: var(--hover);
}
.mi-chip.on {
  border-color: var(--accent);
  background: var(--adim);
  color: var(--accent);
}
.mi-glyphs {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}
.mi-glyph {
  aspect-ratio: 1;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  background: var(--elevated);
  color: var(--t1);
  border-radius: 9px;
  cursor: pointer;
  transition: transform 0.12s;
}
.mi-glyph:hover {
  transform: scale(1.1);
}
.mi-glyph.on {
  border-color: var(--accent);
  background: var(--adim);
  color: var(--accent);
}
.mi-select,
.mi-notes,
.mi-when-field input,
.mi-stop-year,
.mi-stop-note {
  border: 1px solid var(--border);
  background: var(--elevated);
  color: var(--t1);
  border-radius: 8px;
  font-family: var(--font);
  font-size: 13px;
  padding: 6px 8px;
  outline: none;
}
.mi-select:focus,
.mi-notes:focus,
.mi-when-field input:focus,
.mi-stop-year:focus,
.mi-stop-note:focus {
  border-color: var(--accent);
}
.mi-notes {
  resize: vertical;
}
.mi-swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.mi-swatch {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--surface);
  box-shadow: 0 0 0 1px var(--border);
  cursor: pointer;
  transition: transform 0.12s;
  display: grid;
  place-items: center;
  padding: 0;
  color: var(--t2);
  position: relative;
  overflow: hidden;
}
.mi-swatch:hover {
  transform: scale(1.15);
}
.mi-swatch.on {
  box-shadow: 0 0 0 2px var(--accent);
}
.mi-swatch-auto,
.mi-swatch-custom {
  background: var(--elevated);
}
.mi-swatch-custom input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
.mi-range {
  width: 100%;
  accent-color: var(--accent);
}
.mi-when {
  display: flex;
  align-items: flex-end;
  gap: 6px;
}
.mi-when-field {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11.5px;
  color: var(--t3);
}
.mi-when-field input {
  width: 100%;
}
.mi-when-dash {
  color: var(--t3);
  flex: 0 0 auto;
  margin-bottom: 9px;
}
.mi-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.mi-mini {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: var(--ctl-xs);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--t2);
  border-radius: 7px;
  padding: 3px 8px;
  font-size: 12px;
  font-family: var(--font);
  cursor: pointer;
}
.mi-mini:hover {
  background: var(--hover);
  color: var(--t1);
}
.mi-hint {
  font-size: 12px;
  line-height: 1.45;
  color: var(--t3);
}
.mi-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}
.mi-act {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: var(--ctl-md);
  min-width: var(--ctl-md);
  border: 1px solid var(--border);
  background: var(--elevated);
  color: var(--t1);
  border-radius: 9px;
  cursor: pointer;
  font-family: var(--font);
  font-size: 12.5px;
  padding: 0 8px;
  transition:
    background 0.12s,
    transform 0.12s;
}
.mi-act:hover {
  background: var(--hover);
  transform: translateY(-1px);
}
.mi-act.on {
  background: var(--adim);
  border-color: var(--accent);
  color: var(--accent);
}
.mi-act-wide {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
}
.mi-act-text {
  overflow: hidden;
  text-overflow: ellipsis;
}
.mi-act-era {
  order: -1;
  flex-basis: 100%;
}
.mi-danger:hover {
  background: rgba(var(--danger-rgb), 0.18);
  color: var(--danger);
}
.mi-stops {
  display: flex;
  flex-direction: column;
  gap: 4px;
  position: relative;
}
.mi-stop {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 3px;
  border-radius: 9px;
  transition: background 0.2s;
}
.mi-stop.here {
  background: var(--adim);
}
.mi-stop-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  flex: 0 0 auto;
}
.mi-stop-year {
  width: 64px;
  padding: 4px 6px;
}
.mi-stop-note {
  flex: 1;
  min-width: 0;
  padding: 4px 6px;
}
.mi-stop-go,
.mi-stop-x {
  border: none;
  background: transparent;
  color: var(--t3);
  cursor: pointer;
  border-radius: 6px;
  width: var(--ctl-xs);
  height: var(--ctl-xs);
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}
.mi-stop-go:hover,
.mi-stop-x:hover {
  background: var(--hover);
  color: var(--t1);
}
.mi-stop-enter-active,
.mi-stop-leave-active {
  transition: all 0.25s cubic-bezier(0.22, 1, 0.36, 1);
}
.mi-stop-enter-from,
.mi-stop-leave-to {
  opacity: 0;
  transform: translateX(12px);
}
</style>
