<template>
  <aside class="mp" @pointerdown.stop @wheel.stop @keydown.stop>
    <header class="mp-head">
      <div class="mp-title">
        <UiIcon name="users" :size="16" />
        {{ t('map.people.title', { noun: nounLabel(noun) }) }}
      </div>
      <button
        class="mp-x"
        :title="t('map.inspector.close')"
        :aria-label="t('map.inspector.close')"
        @click="emit('close')"
      >
        <UiIcon name="x" :size="16" />
      </button>
    </header>
    <SearchField v-model="query" size="sm" :placeholder="t('map.people.search')" />
    <p class="mp-hint">{{ t('map.people.hint') }}</p>
    <button v-if="autoCount" class="mp-auto" @click="emit('auto-place')">
      <UiIcon name="sparkles" :size="14" />
      {{ t('map.people.autoPlace', { n: autoCount }) }}
    </button>
    <div class="mp-list">
      <div
        v-for="(p, i) in shown"
        :key="p.id"
        class="mp-row"
        :class="{ placed: placedIds.has(p.id), gone: !p.visible }"
        :style="{ '--i': Math.min(i, 20) }"
        draggable="true"
        :title="placedIds.has(p.id) ? t('map.people.flyTo') : t('map.people.dragOrTap')"
        @dragstart="onDragStart($event, p)"
        @click="emit(placedIds.has(p.id) ? 'fly-to' : 'place', p.id)"
      >
        <span class="mp-avatar" :style="{ background: p.color }">
          <img v-if="p.imgUrl" :src="p.imgUrl" alt="" draggable="false" />
          <span v-else>{{ p.initial }}</span>
        </span>
        <span class="mp-name">{{ p.name }}</span>
        <UiIcon v-if="placedIds.has(p.id)" class="mp-pin" name="map-pin" :size="14" />
        <UiIcon v-else class="mp-add" name="plus" :size="14" />
      </div>
      <div v-if="!shown.length" class="mp-empty">{{ t('map.people.none') }}</div>
    </div>
  </aside>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useI18n } from '../../i18n'
import { nounLabel } from '../../lib/dataLabels'
import UiIcon from '../ui/UiIcon.js'
import SearchField from '../ui/SearchField.vue'

// The people drawer: every person in the project, draggable onto the map
// (or tap to drop them at the view's centre). Placed people show a pin and
// clicking them flies the camera over.
const props = defineProps({
  people: { type: Array, required: true },
  placedIds: { type: Set, required: true },
  noun: { type: String, default: 'Person' },
  autoCount: { type: Number, default: 0 }
})
const emit = defineEmits(['close', 'place', 'fly-to', 'auto-place'])
const { t } = useI18n()

const query = ref('')
const shown = computed(() => {
  const q = query.value.trim().toLowerCase()
  const list = q ? props.people.filter((p) => p.name.toLowerCase().includes(q)) : props.people
  // unplaced first — they're the ones you're looking for
  return list
    .slice()
    .sort((a, b) => (props.placedIds.has(a.id) ? 1 : 0) - (props.placedIds.has(b.id) ? 1 : 0))
})

function onDragStart(e, p) {
  e.dataTransfer.setData('text/x-map-person', p.id)
  e.dataTransfer.effectAllowed = 'copy'
}
</script>

<style scoped>
.mp {
  position: absolute;
  left: 72px;
  top: 14px;
  bottom: 136px;
  width: 244px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--glass-soft);
  backdrop-filter: blur(16px) saturate(1.3);
  -webkit-backdrop-filter: blur(16px) saturate(1.3);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow);
  z-index: 9;
}
.mp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.mp-title {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  font-weight: 700;
  color: var(--t1);
  font-size: 14px;
}
.mp-x {
  border: none;
  background: transparent;
  color: var(--t3);
  cursor: pointer;
  width: var(--ctl-sm);
  height: var(--ctl-sm);
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border-radius: 7px;
}
.mp-x:hover {
  background: var(--hover);
  color: var(--t1);
}
.mp-hint {
  font-size: 12px;
  color: var(--t3);
  line-height: 1.4;
}
.mp-auto {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: var(--ctl-sm);
  border: 1px dashed var(--accent);
  background: var(--adim);
  color: var(--accent);
  border-radius: 9px;
  padding: 6px 8px;
  font-family: var(--font);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}
.mp-auto:hover {
  filter: brightness(1.15);
}
.mp-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0 -4px;
  padding: 0 4px;
}
.mp-row {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 5px 7px;
  border-radius: 10px;
  cursor: grab;
  transition:
    background 0.12s,
    transform 0.15s;
  animation: mp-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) backwards;
  animation-delay: calc(var(--i) * 14ms);
}
@keyframes mp-in {
  from {
    opacity: 0;
    transform: translateX(-8px);
  }
}
.mp-row:hover {
  background: var(--hover);
  transform: translateX(2px);
}
.mp-row:active {
  cursor: grabbing;
}
.mp-row.gone .mp-avatar {
  opacity: 0.55;
}
.mp-row.gone .mp-name {
  color: var(--t3);
}
.mp-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  overflow: hidden;
  display: grid;
  place-items: center;
  color: #fff;
  font-weight: 700;
  font-size: 12.5px;
  flex: 0 0 auto;
}
.mp-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.mp-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--t1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mp-pin {
  flex: 0 0 auto;
  color: var(--accent);
}
.mp-add {
  flex: 0 0 auto;
  color: var(--accent);
  opacity: 0;
  transition: opacity 0.12s;
}
.mp-row:hover .mp-add {
  opacity: 1;
}
.mp-empty {
  font-size: 12.5px;
  color: var(--t3);
  text-align: center;
  padding: 16px 0;
}
</style>
