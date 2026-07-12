<template>
  <div class="part-grid">
    <button
      v-if="slotDef?.optional"
      class="part-tile"
      :class="{ active: currentPartId === null }"
      :title="t('character.none')"
      @click="$emit('pick', null)"
    >
      <span class="part-none">∅</span>
    </button>
    <button
      v-for="part in options"
      :key="part.id"
      class="part-tile"
      :class="{ active: part.id === currentPartId }"
      @click="$emit('pick', part.id)"
    >
      <canvas :ref="(el) => setTile(el, part.id)" class="part-thumb"></canvas>
    </button>
  </div>
</template>

<script setup>
import { computed, onMounted, watch, nextTick } from 'vue'
import { useI18n } from '../../i18n'
import { partsFor, resolveLayers, slotOf, slotState } from './characterModel'
import { drawLayers, fitRegion } from './render/SpriteCompositor2D'

// The active slot's catalog as in-context previews: each tile renders the
// CURRENT draft with the candidate part swapped in, cropped to the slot's
// thumb region — so a hairstyle is previewed on this face in this palette.
// Catalogs are small (≤7 per slot), so tiles just redraw on relevant changes.

const props = defineProps({
  doc: { type: Object, required: true },
  pack: { type: Object, required: true },
  slotId: { type: String, required: true }
})
defineEmits(['pick'])
const { t } = useI18n()

const TILE = 84

const slotDef = computed(() => slotOf(props.pack, props.slotId))
const options = computed(() => partsFor(props.pack, props.slotId))
const currentPartId = computed(() => slotState(props.doc, props.pack, props.slotId).partId)

const tiles = new Map() // partId → canvas
function setTile(el, partId) {
  if (el) tiles.set(partId, el)
  else tiles.delete(partId)
}

function drawTiles() {
  const slot = slotDef.value
  if (!slot) return
  const dpr = window.devicePixelRatio || 1
  const size = Math.round(TILE * dpr)
  for (const part of options.value) {
    const canvas = tiles.get(part.id)
    if (!canvas) continue
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    const preview = {
      ...props.doc,
      parts: { ...props.doc.parts, [props.slotId]: { partId: part.id, scale: 1 } }
    }
    drawLayers(ctx, resolveLayers(preview, props.pack), fitRegion(slot.thumb, size, size, 4 * dpr))
  }
}

onMounted(drawTiles)
// Palette / part / person changes all reshape the previews
watch(
  () => [props.slotId, props.doc.id, props.doc.palette, props.doc.parts],
  () => nextTick(drawTiles),
  { deep: true }
)
</script>

<style scoped>
.part-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
  gap: 8px;
}

.part-tile {
  aspect-ratio: 1;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--elevated);
  cursor: pointer;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    border-color 0.15s,
    box-shadow 0.2s,
    transform 0.15s;
}

.part-tile:hover {
  border-color: var(--accent);
  transform: translateY(-1px);
}

.part-tile.active {
  border-color: var(--accent);
  background: var(--adim);
  box-shadow: 0 0 8px rgba(108, 142, 245, 0.25);
}

.part-thumb {
  width: 100%;
  height: 100%;
}

.part-none {
  font-size: 22px;
  color: var(--t3);
}
</style>
