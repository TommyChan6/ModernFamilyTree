<template>
  <!-- The Dynamics lens key: the cold ↔ warm ramp, what line width means, and
       how the family's bonds split. Shown in the graph's pane stack while the
       lens is on. -->
  <div class="dyl canvas-pane" @pointerdown.stop @wheel.stop @click.stop>
    <div class="dyl-head">
      <UiIcon class="dyl-ic" name="thermometer" :size="14" />
      <span class="dyl-title">{{ t('sentiment.legendTitle') }}</span>
      <button
        class="icon-btn sm dyl-x"
        :title="t('sentiment.close')"
        :aria-label="t('sentiment.close')"
        @click="$emit('close')"
      >
        <UiIcon name="x" :size="14" />
      </button>
    </div>
    <div class="dyl-ramp" :style="{ background: `linear-gradient(90deg, ${gradient})` }"></div>
    <div class="dyl-ends">
      <span>{{ t('sentiment.cold') }}</span>
      <span>{{ t('sentiment.neutral') }}</span>
      <span>{{ t('sentiment.warm') }}</span>
    </div>
    <div class="dyl-widths" aria-hidden="true">
      <span class="dyl-end">{{ t('sentiment.faint') }}</span>
      <svg class="dyl-wsvg" viewBox="0 0 120 16" preserveAspectRatio="none">
        <line
          v-for="(w, i) in WIDTHS"
          :key="i"
          :x1="i * 40 + 4"
          :x2="i * 40 + 36"
          y1="8"
          y2="8"
          :stroke-width="w"
          stroke-linecap="round"
        />
      </svg>
      <span class="dyl-end">{{ t('sentiment.strong') }}</span>
    </div>
    <div class="dyl-note">{{ t('sentiment.widthNote') }}</div>
    <div class="dyl-note">{{ t('sentiment.ringNote') }}</div>
    <div v-if="counts" class="dyl-counts">
      <span class="dyl-bar" aria-hidden="true">
        <i :style="{ flex: counts.cold, background: palette.cold }"></i>
        <i :style="{ flex: counts.neutral, background: palette.neutral }"></i>
        <i :style="{ flex: counts.warm, background: palette.warm }"></i>
      </span>
      <span class="dyl-count-text">{{ t('sentiment.counts', counts) }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useMainStore } from '../../store/index.js'
import { useI18n } from '../../i18n'
import { dynamicsWidth, sentimentGradient } from '../../../../shared/sentiment'
import UiIcon from '../ui/UiIcon.js'

defineProps({
  /** { warm, neutral, cold } bond counts, or null. */
  counts: { type: Object, default: null }
})
defineEmits(['close'])
const store = useMainStore()
const { t } = useI18n()
const palette = computed(() => store.dynamicsPalette)
const gradient = computed(() => sentimentGradient(palette.value))
const WIDTHS = [dynamicsWidth(0.1), dynamicsWidth(0.5), dynamicsWidth(1)]
</script>

<style scoped>
.dyl {
  width: 230px;
  padding: 10px 12px 11px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dyl-head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.dyl-ic {
  color: var(--t2);
}
.dyl-title {
  flex: 1;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--t2);
}
.dyl-x {
  color: var(--t3);
}
.dyl-ramp {
  height: 8px;
  border-radius: 4px;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);
}
.dyl-ends {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  font-weight: 600;
  color: var(--t2);
}
.dyl-widths {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}
.dyl-end {
  font-size: 11px;
  color: var(--t3);
  flex-shrink: 0;
}
.dyl-wsvg {
  flex: 1;
  height: 16px;
  stroke: var(--t2);
}
.dyl-note {
  font-size: 11px;
  line-height: 1.4;
  color: var(--t3);
}
.dyl-counts {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 2px;
  padding-top: 7px;
  border-top: 1px solid var(--border);
}
.dyl-bar {
  display: flex;
  height: 5px;
  border-radius: 3px;
  overflow: hidden;
  gap: 1px;
}
.dyl-bar i {
  display: block;
  min-width: 0;
}
.dyl-count-text {
  font-size: 11px;
  color: var(--t2);
  font-variant-numeric: tabular-nums;
}
</style>
