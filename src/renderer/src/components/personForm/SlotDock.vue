<template>
  <!-- The five slots that drive graph rendering. Traits are dragged in from
       the list (or via a row's "Move to slot"); values are edited in place. -->
  <div ref="dockEl" class="sd">
    <div
      v-for="bay in bays"
      :key="bay.slot"
      class="sd-bay"
      :class="[
        `sd-bay-${bay.slot}`,
        {
          empty: bay.defs.length === 0,
          ok: dragState.active && bay.accepts,
          no: dragState.active && !bay.accepts,
          over: dragState.overSlot === bay.slot
        }
      ]"
      :data-slot="bay.slot"
    >
      <div class="sd-bay-head">
        <span class="sd-bay-glyph">{{ bay.glyph }}</span>
        <span class="sd-bay-label">{{ bay.label }}</span>
        <span class="sd-bay-hint">{{ bay.hint }}</span>
      </div>

      <!-- gender gradient bar: ends edit the graph's male/female colors -->
      <div v-if="bay.slot === 'gender'" class="sd-gradient">
        <input
          type="color"
          class="sd-grad-pick"
          :value="store.graphSettings.maleColor"
          title="Left gradient color"
          @input="store.updateGraphSetting('maleColor', $event.target.value)"
        />
        <div class="sd-grad-bar" :style="{ background: genderGradient }">
          <span
            v-if="genderT != null"
            class="sd-grad-marker"
            :style="{ left: genderT * 100 + '%', background: genderColor }"
          ></span>
        </div>
        <input
          type="color"
          class="sd-grad-pick"
          :value="store.graphSettings.femaleColor"
          title="Right gradient color"
          @input="store.updateGraphSetting('femaleColor', $event.target.value)"
        />
      </div>

      <!-- slotted trait cards -->
      <TransitionGroup name="sd-card" tag="div" class="sd-cards">
        <div v-for="(def, i) in bay.defs" :key="def.id" class="sd-card">
          <div class="sd-card-head">
            <span v-if="def.icon" class="sd-card-icon">{{ def.icon }}</span>
            <span class="sd-card-label">{{ def.label }}</span>
            <template v-if="bay.slot === 'name' && bay.defs.length > 1">
              <button
                class="sd-mini"
                type="button"
                :disabled="i === 0"
                title="Earlier in the name"
                @click="reorderName(def, -1)"
              >
                ‹
              </button>
              <button
                class="sd-mini"
                type="button"
                :disabled="i === bay.defs.length - 1"
                title="Later in the name"
                @click="reorderName(def, 1)"
              >
                ›
              </button>
            </template>
            <input
              v-if="bay.slot === 'highlight'"
              type="color"
              class="sd-hl-color"
              :value="def.config.slotColor || '#6c8ef5'"
              title="Ring color"
              @input="setSlotColor(def, $event.target.value)"
            />
            <button
              class="sd-mini sd-eject"
              type="button"
              title="Remove from slot (back to the trait list)"
              @click="store.setFieldSlot(def.id, null)"
            >
              ⏏
            </button>
          </div>
          <FieldInput
            :def="def"
            :model-value="draft[def.id]?.value ?? null"
            :track-gradient="bay.slot === 'gender' ? genderGradient : ''"
            :placeholder="bay.slot === 'name' ? def.label + '…' : ''"
            @update:model-value="emit('update', def.id, { value: $event })"
          />
        </div>
      </TransitionGroup>

      <div v-if="bay.defs.length === 0" class="sd-empty-hint">
        {{ dragState.active && bay.accepts ? 'Drop it here' : 'drag a trait here' }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useMainStore } from '../../store/index.js'
import { genderInfo, lerpColorHex, slotAccepts } from '../../../../shared/fields'
import { SLOT_META } from './fieldUi.js'
import FieldInput from './FieldInput.vue'

const props = defineProps({
  defs: { type: Array, required: true },
  draft: { type: Object, required: true }, // fieldId → { value, ... }
  /** { active, defType, overSlot } while a list row is being dragged */
  dragState: { type: Object, default: () => ({ active: false, defType: null, overSlot: null }) }
})
const emit = defineEmits(['update'])

const store = useMainStore()
const dockEl = ref(null)

const bays = computed(() =>
  SLOT_META.map((m) => ({
    ...m,
    defs: props.defs
      .filter((d) => d.slot === m.slot)
      .sort((a, b) => a.slot_order - b.slot_order || a.order - b.order),
    accepts: props.dragState.defType ? slotAccepts(m.slot, props.dragState.defType) : false
  }))
)

const genderDef = computed(() => props.defs.find((d) => d.slot === 'gender') || null)
const genderGradient = computed(
  () =>
    `linear-gradient(90deg, ${store.graphSettings.maleColor}, ${store.graphSettings.femaleColor})`
)
const genderT = computed(() => {
  if (!genderDef.value) return null
  return genderInfo(genderDef.value, props.draft[genderDef.value.id]?.value ?? null).t
})
const genderColor = computed(() =>
  genderT.value == null
    ? store.graphSettings.unknownColor
    : lerpColorHex(store.graphSettings.maleColor, store.graphSettings.femaleColor, genderT.value)
)

function reorderName(def, dir) {
  const nameDefs = bays.value.find((b) => b.slot === 'name').defs
  const idx = nameDefs.findIndex((d) => d.id === def.id)
  const swap = nameDefs[idx + dir]
  if (!swap) return
  // Two writes: give each the other's position.
  store.setFieldSlot(def.id, 'name', swap.slot_order)
  store.setFieldSlot(swap.id, 'name', def.slot_order)
}

function setSlotColor(def, color) {
  // JSON round-trip strips Vue reactivity before the config crosses IPC.
  const config = JSON.parse(JSON.stringify({ ...def.config, slotColor: color }))
  store.updateFieldDef({ id: def.id, config })
}

/** Hit-test a pointer position against the bays (used by the drag system). */
function bayAt(x, y) {
  if (!dockEl.value) return null
  for (const el of dockEl.value.querySelectorAll('.sd-bay')) {
    const r = el.getBoundingClientRect()
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return el.dataset.slot
  }
  return null
}
defineExpose({ bayAt })
</script>

<style scoped>
.sd {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.sd-bay {
  border: 1.5px solid var(--border);
  border-radius: 12px;
  padding: 9px 10px 10px;
  background: color-mix(in srgb, var(--elevated) 42%, transparent);
  display: flex;
  flex-direction: column;
  gap: 7px;
  transition:
    border-color 0.2s,
    box-shadow 0.25s,
    transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 0.2s;
}
.sd-bay-name,
.sd-bay-gender,
.sd-bay-highlight {
  grid-column: span 2;
}

/* drag feedback: compatible bays glow & lift, incompatible ones dim */
.sd-bay.ok {
  border-color: color-mix(in srgb, var(--accent) 55%, transparent);
  border-style: dashed;
  box-shadow: 0 0 0 3px var(--adim);
}
.sd-bay.ok.over {
  border-color: var(--accent);
  transform: scale(1.02);
  box-shadow:
    0 0 0 5px var(--adim),
    0 8px 24px var(--adim);
}
.sd-bay.no {
  opacity: 0.35;
  filter: saturate(0.4);
}

.sd-bay-head {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.sd-bay-glyph {
  color: var(--accent);
  font-size: 12px;
}
.sd-bay-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.7px;
  color: var(--t2);
}
.sd-bay-hint {
  font-size: 9px;
  color: var(--t3);
  margin-left: auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sd-cards {
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.sd-bay-name .sd-cards {
  flex-direction: row;
  flex-wrap: wrap;
}
.sd-bay-name .sd-card {
  flex: 1;
  min-width: 130px;
}
.sd-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.sd-card-enter-active,
.sd-card-leave-active,
.sd-card-move {
  transition:
    transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 0.2s;
}
.sd-card-enter-from {
  opacity: 0;
  transform: scale(0.9) translateY(4px);
}
.sd-card-leave-to {
  opacity: 0;
  transform: scale(0.92);
}
.sd-card-head {
  display: flex;
  align-items: center;
  gap: 4px;
}
.sd-card-icon {
  font-size: 10.5px;
}
.sd-card-label {
  font-size: 10.5px;
  font-weight: 600;
  color: var(--t3);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sd-mini {
  border: none;
  background: transparent;
  color: var(--t3);
  cursor: pointer;
  font-size: 11px;
  line-height: 1;
  padding: 2px 4px;
  border-radius: 5px;
  transition:
    color 0.12s,
    background 0.12s;
}
.sd-mini:hover:not(:disabled) {
  color: var(--t1);
  background: var(--hover);
}
.sd-mini:disabled {
  opacity: 0.3;
  cursor: default;
}
.sd-eject:hover {
  color: var(--amber) !important;
}
.sd-hl-color {
  width: 18px;
  height: 18px;
  padding: 1px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: transparent;
  cursor: pointer;
}

.sd-empty-hint {
  font-size: 10.5px;
  color: var(--t3);
  font-style: italic;
  text-align: center;
  padding: 8px 0 6px;
  border: 1px dashed var(--border);
  border-radius: 8px;
}
.sd-bay.ok .sd-empty-hint {
  color: var(--accent);
  border-color: var(--accent);
}

/* gender gradient */
.sd-gradient {
  display: flex;
  align-items: center;
  gap: 7px;
}
.sd-grad-pick {
  width: 20px;
  height: 20px;
  padding: 1px;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;
}
.sd-grad-pick::-webkit-color-swatch-wrapper {
  padding: 1px;
}
.sd-grad-pick::-webkit-color-swatch {
  border: none;
  border-radius: 50%;
}
.sd-grad-bar {
  position: relative;
  flex: 1;
  height: 8px;
  border-radius: 999px;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.25);
}
.sd-grad-marker {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid var(--surface);
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.45);
  transition:
    left 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
    background 0.25s;
}
</style>
