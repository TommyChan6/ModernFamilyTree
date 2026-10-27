<template>
  <!-- 水墨 backdrop for full-screen pages in the Ink theme: rice paper, two
       soft washes, a huge cursive watermark (草书) brushed down one side, a
       far range of hills at the foot and a band of mist drifting across it.
       Pure CSS motion (transform/opacity only) — nothing runs per frame in JS.
       In the medieval theme it hands over to MedievalBackdrop (vellum,
       candlelight, a far country of castles); renders nothing in the others. -->
  <div v-if="store.isInk" class="inkbd" :class="{ fixed }" aria-hidden="true">
    <span class="inkbd-wash inkbd-wash-a"></span>
    <span class="inkbd-wash inkbd-wash-b"></span>
    <span v-if="watermark" class="inkbd-mark">{{ watermark }}</span>
    <span v-if="hills" class="inkbd-hills"></span>
    <span v-if="hills" class="inkbd-mist"></span>
  </div>
  <MedievalBackdrop v-else-if="store.isMedieval" :hills="hills" :fixed="fixed" />
</template>

<script setup>
import { useMainStore } from '../../store/index.js'
import MedievalBackdrop from './MedievalBackdrop.vue'

defineProps({
  /** A few characters brushed huge and faint down the right edge. */
  watermark: { type: String, default: '' },
  /** The misty range of hills along the bottom. */
  hills: { type: Boolean, default: true },
  /** position: fixed (for scrolling pages) instead of absolute. */
  fixed: { type: Boolean, default: false }
})

const store = useMainStore()
</script>

<style scoped>
.inkbd {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
  background-color: var(--bg);
  background-image:
    radial-gradient(ellipse 85% 70% at 45% 35%, rgba(255, 252, 244, 0.6), transparent 70%),
    radial-gradient(ellipse 120% 90% at 50% 45%, transparent 60%, rgba(110, 80, 40, 0.1)),
    var(--ink-paper, none);
  background-size:
    100% 100%,
    100% 100%,
    512px 512px;
}
.inkbd.fixed {
  position: fixed;
}
.inkbd-wash {
  position: absolute;
  border-radius: 50%;
  filter: blur(30px);
  animation: inkbd-bloom 2.8s cubic-bezier(0.16, 0.8, 0.3, 1) both;
}
.inkbd-wash-a {
  width: 60vmax;
  height: 42vmax;
  left: -18vmax;
  top: -14vmax;
  background: radial-gradient(closest-side, rgba(28, 26, 23, 0.1), transparent);
}
.inkbd-wash-b {
  width: 50vmax;
  height: 36vmax;
  right: -14vmax;
  top: 30%;
  background: radial-gradient(closest-side, rgba(61, 90, 115, 0.1), transparent);
  animation-delay: 0.2s;
}
@keyframes inkbd-bloom {
  from {
    transform: scale(0.3);
    opacity: 0;
  }
}
.inkbd-mark {
  position: absolute;
  right: 4vw;
  top: 6vh;
  writing-mode: vertical-rl;
  font-family: var(--font-cao);
  font-size: min(36vh, 300px);
  line-height: 1;
  color: var(--ink-black);
  opacity: 0.06;
  animation: inkbd-write 2.4s 0.2s var(--ease-out) both;
}
@keyframes inkbd-write {
  from {
    clip-path: inset(0 0 100% 0);
    opacity: 0;
  }
}
.inkbd-hills {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: min(34vh, 300px);
  background: var(--ink-landscape, none) center bottom / auto 100% repeat-x;
  opacity: 0.2;
  animation: inkbd-rise 2s var(--ease-out) both;
}
@keyframes inkbd-rise {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
}
.inkbd-mist {
  position: absolute;
  left: -25%;
  right: -25%;
  bottom: 8vh;
  height: 14vh;
  background: radial-gradient(ellipse 50% 50% at 50% 50%, rgba(245, 239, 224, 0.8), transparent);
  animation: inkbd-drift 16s ease-in-out infinite alternate;
}
@keyframes inkbd-drift {
  from {
    transform: translateX(-8%);
  }
  to {
    transform: translateX(8%);
  }
}
@media (prefers-reduced-motion: reduce) {
  .inkbd-wash,
  .inkbd-mark,
  .inkbd-hills,
  .inkbd-mist {
    animation: none;
  }
}
</style>
