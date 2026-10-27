<template>
  <div
    ref="rootRef"
    class="fp-mandala"
    :class="{ drawn, visible }"
    role="img"
    :aria-label="label || t('fingerprint.title')"
  >
    <canvas ref="spinRef" class="fp-cv" :class="{ spinning: spin }"></canvas>
    <canvas v-if="spin" ref="fixedRef" class="fp-cv"></canvas>
  </div>
</template>

<script setup>
// The family fingerprint mandala (lib/familyFingerprint.ts) on a canvas:
// devicePixelRatio-aware, drawn lazily the first time it scrolls into view,
// redrawn (debounced) when the tree's features, theme or accent change.
// `spin` turns the mandala slowly via a CSS transform on its own canvas —
// no per-frame redraws; paused off screen and under reduced motion. The
// fixed layer (ink seal, gilt border) sits on a second, still canvas.
import { ref, shallowRef, computed, watch, onMounted, onUnmounted, effect, stop } from 'vue'
import { useMainStore } from '../../store/index.js'
import { useI18n } from '../../i18n'
import { buildMandala, drawMandala } from '../../lib/familyFingerprint'

const props = defineProps({
  /** Project whose fingerprint to show (read from the store). */
  projectId: { type: String, default: null },
  /** Explicit FingerprintFeatures — overrides the projectId lookup. */
  features: { type: Object, default: null },
  /** Base hue (the project card's); null = derived from the project seed. */
  hue: { type: Number, default: null },
  spin: { type: Boolean, default: false },
  background: { type: Boolean, default: false },
  /** 'dark' | 'light' | 'ink' | 'medieval'; default follows the app theme. */
  theme: { type: String, default: null },
  label: { type: String, default: '' }
})

const store = useMainStore()
const { t } = useI18n()

const rootRef = ref(null)
const spinRef = ref(null)
const fixedRef = ref(null)
const drawn = ref(false)
const visible = ref(false)

const themeKey = computed(
  () =>
    props.theme ||
    (store.isInk ? 'ink' : store.isMedieval ? 'medieval' : store.isLightTheme ? 'light' : 'dark')
)

// Features are pulled through a scheduler-driven effect: a data change only
// marks it stale, and the (O(n + e)) recompute + redraw happen once the edits
// settle — never per keystroke.
const current = shallowRef(null)
let settleTimer = 0
const runner = effect(
  () => {
    current.value = props.features ?? store.fingerprintOf(props.projectId)
  },
  {
    scheduler: () => {
      clearTimeout(settleTimer)
      settleTimer = setTimeout(runner, drawn.value ? 300 : 0)
    }
  }
)

const mandala = computed(() =>
  current.value
    ? buildMandala(current.value, {
        theme: themeKey.value,
        accent: store.accent,
        hue: props.hue,
        genderColors: [store.graphSettings?.maleColor, store.graphSettings?.femaleColor],
        background: props.background
      })
    : null
)

let dirty = true
function draw() {
  const root = rootRef.value
  const cv = spinRef.value
  if (!root || !cv) return
  if (!visible.value) {
    dirty = true
    return
  }
  const size = Math.max(
    1,
    Math.floor(Math.min(root.clientWidth, root.clientHeight || root.clientWidth))
  )
  const dpr = Math.min(3, window.devicePixelRatio || 1)
  const px = Math.max(1, Math.round(size * dpr))
  const paint = (canvas, layer) => {
    if (!canvas) return
    if (canvas.width !== px) canvas.width = px
    if (canvas.height !== px) canvas.height = px
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, px, px)
    if (mandala.value) drawMandala(ctx, mandala.value, px, { layer })
  }
  paint(cv, props.spin ? 'spin' : 'all')
  if (props.spin) paint(fixedRef.value, 'fixed')
  dirty = false
  drawn.value = true
}

let raf = 0
function requestDraw() {
  dirty = true
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(draw)
}
watch(mandala, requestDraw)
watch(() => props.spin, requestDraw, { flush: 'post' })

let io = null
let ro = null
onMounted(() => {
  const root = rootRef.value
  if (typeof IntersectionObserver === 'function') {
    io = new IntersectionObserver(
      (entries) => {
        visible.value = entries.some((e) => e.isIntersecting)
        if (visible.value && dirty) requestDraw()
      },
      { rootMargin: '120px' }
    )
    io.observe(root)
  } else {
    visible.value = true
  }
  if (typeof ResizeObserver === 'function') {
    ro = new ResizeObserver(requestDraw)
    ro.observe(root)
  }
  requestDraw()
})

onUnmounted(() => {
  stop(runner)
  clearTimeout(settleTimer)
  cancelAnimationFrame(raf)
  io?.disconnect()
  ro?.disconnect()
})
</script>

<style scoped>
.fp-mandala {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  pointer-events: none;
}

.fp-cv {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  opacity: 0;
  transform: scale(0.94);
  transition:
    opacity 0.6s var(--ease-out, ease-out),
    transform 0.8s var(--ease-out, ease-out);
}

.fp-mandala.drawn .fp-cv {
  opacity: 1;
  transform: none;
}

.fp-mandala.drawn .fp-cv.spinning {
  animation: fp-turn 240s linear infinite;
  animation-play-state: paused;
}

.fp-mandala.drawn.visible .fp-cv.spinning {
  animation-play-state: running;
}

@keyframes fp-turn {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .fp-cv {
    transition: none;
  }
  .fp-mandala.drawn .fp-cv.spinning {
    animation: none;
  }
}
</style>
