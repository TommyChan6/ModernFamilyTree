<template>
  <div class="ef">
    <div class="ef-group">
      <span class="ef-label">{{ t('sentiment.feeling') }}</span>
      <FeelingSlider
        :model-value="shownSentiment"
        :ghost="sentiment == null"
        :aria-label="t('sentiment.feelingAria')"
        @update:model-value="setSentiment"
      />
      <span class="ef-word" :style="{ '--ef-c': wordColor }">
        <i class="ef-dot"></i>{{ t('sentiment.levels.' + level) }}
      </span>
      <button
        v-if="sentiment != null"
        type="button"
        class="btn btn-ghost btn-xs ef-reset"
        :title="t('sentiment.fromTypeTitle')"
        @click="inheritSentiment"
      >
        <UiIcon name="rotate-ccw" :size="12" />{{ t('sentiment.fromType') }}
      </button>
    </div>
    <div class="ef-group">
      <span class="ef-label">{{ t('sentiment.intensity') }}</span>
      <FeelingSlider
        kind="intensity"
        :model-value="shownIntensity"
        :ghost="intensity == null"
        :aria-label="t('sentiment.intensityAria')"
        @update:model-value="setIntensity"
      />
      <span class="ef-pct">{{ Math.round(shownIntensity * 100) }}%</span>
      <button
        v-if="intensity != null"
        type="button"
        class="btn btn-ghost btn-xs ef-reset"
        :title="t('sentiment.defaultIntensityTitle')"
        @click="defaultIntensity"
      >
        <UiIcon name="rotate-ccw" :size="12" />{{ t('sentiment.defaultIntensity') }}
      </button>
    </div>
  </div>
</template>

<script setup>
// Per-bond feeling: a sentiment (cold ↔ warm, or inherit the type's) and an
// intensity (faint ↔ strong, or the default). Edits a draft (v-model) — the
// host form saves it with the rest of the bond.
import { computed } from 'vue'
import { useMainStore } from '../../store/index.js'
import { useI18n } from '../../i18n'
import {
  DEFAULT_INTENSITY,
  sentimentColor,
  sentimentLevel,
  typeSentiment
} from '../../../../shared/sentiment'
import UiIcon from '../ui/UiIcon.js'
import FeelingSlider from './FeelingSlider.vue'

const props = defineProps({
  sentiment: { type: Number, default: null },
  intensity: { type: Number, default: null },
  typeKey: { type: String, default: '' }
})
const emit = defineEmits(['update:sentiment', 'update:intensity'])
const store = useMainStore()
const { t } = useI18n()

const inherited = computed(() => typeSentiment(store.relTypeByKey.get(props.typeKey)))
const shownSentiment = computed(() => props.sentiment ?? inherited.value)
const shownIntensity = computed(() => props.intensity ?? DEFAULT_INTENSITY)
const level = computed(() => sentimentLevel(shownSentiment.value))
const wordColor = computed(() => sentimentColor(shownSentiment.value, store.dynamicsPalette))

function setSentiment(v) {
  emit('update:sentiment', v)
}
function setIntensity(v) {
  emit('update:intensity', v)
}
function inheritSentiment() {
  emit('update:sentiment', null)
}
function defaultIntensity() {
  emit('update:intensity', null)
}
</script>

<style scoped>
.ef {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 22px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--border);
}
.ef-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1 1 260px;
  min-width: 0;
  height: var(--ctl-sm);
}
.ef-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--t3);
  flex-shrink: 0;
}
.ef-word {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 64px;
  font-size: 12px;
  font-weight: 600;
  color: var(--t2);
  white-space: nowrap;
}
.ef-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--ef-c);
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.08);
}
.ef-pct {
  min-width: 34px;
  font-size: 12px;
  font-weight: 600;
  color: var(--t2);
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.ef-reset {
  gap: 4px;
  flex-shrink: 0;
  color: var(--t3);
}
</style>
