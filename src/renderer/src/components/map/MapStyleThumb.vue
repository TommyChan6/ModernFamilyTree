<template>
  <canvas ref="canvasEl" class="mst"></canvas>
</template>

<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { MapRenderer } from './MapRenderer'
import { styleOf } from './mapStyles'
import { fitCamera } from './mapMath'

// A small still of a map rendered in a given style — the style pickers show
// the user's OWN map in every look, not a stock picture.
const props = defineProps({
  doc: { type: Object, required: true },
  styleId: { type: String, required: true },
  width: { type: Number, default: 200 },
  height: { type: Number, default: 130 },
  /** 'dark' | 'light' | 'ink' (the paper theme gets its own desk tone). */
  theme: { type: String, default: 'dark' }
})

const canvasEl = ref(null)
let renderer = null

function draw() {
  if (!canvasEl.value) return
  if (!renderer) {
    renderer = new MapRenderer(canvasEl.value)
    // painted styles: redraw once their sprites + calligraphy fonts arrive
    renderer.onAssets = () => requestAnimationFrame(draw)
  }
  renderer.resize(props.width, props.height, Math.min(2, window.devicePixelRatio || 1))
  const cam = fitCamera(
    { x0: 0, y0: 0, x1: props.doc.width, y1: props.doc.height },
    props.width,
    props.height,
    // a mounted scroll needs room for its silk border and rollers
    styleOf(props.styleId).frame === 'scroll' ? 14 : 6
  )
  renderer.render({
    doc: props.doc,
    version: 0,
    style: styleOf(props.styleId),
    cam,
    year: null,
    time: 0,
    theme: props.theme,
    tokens: [],
    tagColors: new Map(),
    selectedFeatureId: null,
    selectedTokenId: null,
    hoverFeatureId: null,
    hoverTokenId: null,
    preview: null,
    showTrails: false,
    showLabels: false,
    bursts: [],
    exporting: true
  })
}

onMounted(() => requestAnimationFrame(draw))
watch(
  () => [props.doc, props.styleId, props.theme, props.width],
  () => requestAnimationFrame(draw)
)
onUnmounted(() => renderer?.dispose())
</script>

<style scoped>
.mst {
  display: block;
  border-radius: 10px;
}
</style>
