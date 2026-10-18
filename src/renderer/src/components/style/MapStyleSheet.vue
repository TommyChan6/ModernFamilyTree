<template>
  <div class="st-sheet">
    <!-- The open map's look. It lives on the map itself (each map keeps its own),
         so edits go through the Map view's handle: its undo + autosave. -->
    <template v-if="bridge && meta">
      <div class="mst-grid" data-skey="mapStyle">
        <button
          v-for="(s, i) in MAP_STYLE_LIST"
          :key="s.id"
          class="mst-card"
          :class="{ on: s.id === meta.style }"
          :style="{ '--i': i }"
          @click="bridge.setStyle(s.id)"
        >
          <MapStyleThumb
            v-if="thumbDoc"
            :doc="thumbDoc"
            :style-id="s.id"
            :width="132"
            :height="thumbH"
            :theme="store.theme"
          />
          <span class="mst-name"
            ><UiIcon :name="s.icon" :size="13" />{{ t('map.styles.' + s.id) }}</span
          >
        </button>
      </div>
      <StSeg
        skey="mapBase"
        :label="t('map.menu.ground')"
        :model-value="meta.base"
        :options="grounds"
        @update:model-value="bridge.setBase($event)"
      />
    </template>
    <div v-else class="st-empty">
      <UiIcon name="map" :size="22" />
      <p>{{ t('styleStudio.map.none') }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useMainStore } from '../../store/index.js'
import { useI18n } from '../../i18n'
import { MAP_STYLE_LIST } from '../map/mapStyles'
import MapStyleThumb from '../map/MapStyleThumb.vue'
import UiIcon from '../ui/UiIcon.js'
import StSeg from './StSeg.vue'
import { mapStyleBridge } from './styleBridge.js'

defineProps({ chapter: { type: String, default: 'map' } })

const store = useMainStore()
const { t } = useI18n()
const bridge = computed(() => mapStyleBridge.value)
const meta = computed(() => bridge.value?.meta.value || null)
const thumbDoc = computed(() => bridge.value?.thumbDoc.value || null)
// the bridge's thumb height is for 150px-wide stills; rescale to ours
const thumbH = computed(() => Math.round(((bridge.value?.thumbH.value || 100) * 132) / 150))
const grounds = computed(() => [
  { id: 'sea', icon: 'waves', label: t('map.menu.groundSea') },
  { id: 'land', icon: 'wheat', label: t('map.menu.groundLand') }
])
</script>

<style scoped>
.mst-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.mst-card {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 5px;
  border-radius: var(--r-md);
  border: 1px solid var(--border);
  background: var(--elevated);
  color: var(--t2);
  font-family: var(--font);
  cursor: pointer;
  animation: st-pop-in 0.42s var(--ease-out) backwards;
  animation-delay: calc(var(--i) * 0.04s);
  transition:
    transform 0.25s var(--ease-spring),
    border-color var(--dur) ease,
    box-shadow var(--dur) ease;
}
.mst-card :deep(canvas) {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 6px;
}
.mst-card:hover {
  transform: translateY(-3px);
  border-color: var(--border-strong);
}
.mst-card.on {
  color: var(--t1);
  border-color: var(--accent);
  box-shadow:
    0 0 0 1px var(--accent),
    0 8px 22px rgba(var(--accent-rgb), 0.25);
}
.mst-name {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 700;
}
</style>
