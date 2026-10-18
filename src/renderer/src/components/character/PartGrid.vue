<template>
  <div :key="slotId + ':' + pack.id" class="part-grid">
    <button
      v-if="slotDef?.optional"
      class="part-tile"
      :class="{ active: currentPartId === null }"
      :style="{ '--i': 0 }"
      :title="t('character.none')"
      @click="$emit('pick', null)"
      @pointerenter="$emit('hover', null, true)"
      @pointerleave="$emit('hover', undefined)"
    >
      <UiIcon class="part-none" name="ban" :size="24" :stroke="1.75" />
      <span class="part-name">{{ t('character.none') }}</span>
    </button>
    <button
      v-for="(part, i) in options"
      :key="part.id"
      class="part-tile"
      :class="{ active: part.id === currentPartId }"
      :style="{ '--i': i + 1 }"
      :title="nameOf(part.id)"
      @click="$emit('pick', part.id)"
      @pointerenter="$emit('hover', part.id, true)"
      @pointerleave="$emit('hover', undefined)"
    >
      <canvas :ref="(el) => setTile(el, part.id)" class="part-thumb"></canvas>
      <span class="part-name">{{ nameOf(part.id) }}</span>
    </button>
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useI18n } from '../../i18n'
import { partsFor, resolveLayers, slotOf, slotState } from './characterModel'
import { drawLayers, fitRegion } from './render/SpriteCompositor2D'
import UiIcon from '../ui/UiIcon.js'

// The active slot's catalog as in-context previews: each tile renders the
// CURRENT look with the candidate part swapped in, cropped to the slot's
// thumb region — so a hairstyle is previewed on this face in this palette.
// Hovering a tile emits `hover` so the stage can try the part on live
// (game-style); redraws coalesce into one per animation frame.

const props = defineProps({
  doc: { type: Object, required: true },
  pack: { type: Object, required: true },
  slotId: { type: String, required: true }
})
defineEmits(['pick', 'hover'])
const { t } = useI18n()

const TILE = 92

const slotDef = computed(() => slotOf(props.pack, props.slotId))
const options = computed(() => partsFor(props.pack, props.slotId))
const currentPartId = computed(() => slotState(props.doc, props.pack, props.slotId).partId)

/** 'hair-twintails' → 'Twintails', 'acc-headphones' → 'Headphones'
 *  (localized via `characterX.partIds.<id>` / `characterX.parts.<suffix>`). */
function nameOf(id) {
  const rest = id.includes('-') ? id.slice(id.indexOf('-') + 1) : id
  const byId = 'characterX.partIds.' + id
  const exact = t(byId)
  if (exact !== byId) return exact
  const bySuffix = 'characterX.parts.' + rest
  const named = t(bySuffix)
  if (named !== bySuffix) return named
  const s = rest.replace(/-/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const tiles = new Map() // partId → canvas
function setTile(el, partId) {
  if (el) tiles.set(partId, el)
  else tiles.delete(partId)
}

function drawTiles() {
  raf = 0
  const slot = slotDef.value
  if (!slot) return
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const size = Math.round(TILE * dpr)
  for (const part of options.value) {
    const canvas = tiles.get(part.id)
    if (!canvas) continue
    if (canvas.width !== size) {
      canvas.width = size
      canvas.height = size
    }
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, size, size)
    const preview = {
      ...props.doc,
      expression: 'neutral',
      parts: { ...props.doc.parts, [props.slotId]: { partId: part.id, scale: 1 } }
    }
    drawLayers(ctx, resolveLayers(preview, props.pack), fitRegion(slot.thumb, size, size, 4 * dpr))
  }
}

let raf = 0
function schedule() {
  if (!raf) raf = requestAnimationFrame(() => nextTick(drawTiles))
}

onMounted(schedule)
onBeforeUnmount(() => cancelAnimationFrame(raf))
// Palette / part / person / style changes all reshape the previews
watch(
  () => [
    props.slotId,
    props.pack.id,
    props.doc.id,
    props.doc.palette,
    props.doc.parts,
    props.doc.morph
  ],
  schedule,
  { deep: true }
)
</script>

<style scoped>
.part-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  gap: 8px;
}

.part-tile {
  position: relative;
  aspect-ratio: 1;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--elevated);
  cursor: pointer;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: tile-in 0.32s cubic-bezier(0.2, 0.9, 0.3, 1.25) both;
  animation-delay: calc(var(--i) * 22ms);
  transition:
    border-color 0.15s,
    box-shadow 0.2s,
    transform 0.18s cubic-bezier(0.2, 0.9, 0.3, 1.4);
}

.part-tile:hover {
  border-color: var(--accent);
  transform: translateY(-2px) scale(1.04);
  box-shadow: var(--shadow);
}

.part-tile:active {
  transform: scale(0.96);
}

.part-tile.active {
  border-color: var(--accent);
  background: var(--adim);
  box-shadow:
    0 0 0 2px var(--adim),
    0 0 14px var(--adim);
}

.part-thumb {
  width: 100%;
  height: 100%;
}

.part-name {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 10px 4px 3px;
  font-size: 11px;
  font-weight: 600;
  color: var(--t2);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: linear-gradient(to top, var(--elevated), transparent);
  opacity: 0;
  transition: opacity 0.15s;
}

.part-tile:hover .part-name,
.part-tile.active .part-name {
  opacity: 1;
}

.part-tile.active .part-name {
  background: linear-gradient(to top, var(--adim), transparent);
  color: var(--t1);
}

.part-none {
  color: var(--t3);
}

@keyframes tile-in {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.9);
  }
}

@media (prefers-reduced-motion: reduce) {
  .part-tile {
    animation: none;
  }
}
</style>
