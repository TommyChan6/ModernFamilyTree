<template>
  <!-- Medieval backdrop for full-screen pages: a leaf of vellum lit by two
       candles (their glow breathes and gutters), a great compass rose turning
       slowly in one corner as on a portolan chart, a far country of castles
       and woods at the foot with morning haze drifting across, and a few
       motes of dust rising through the candlelight. Pure CSS motion
       (transform/opacity only) — nothing runs per frame in JS. Rendered by
       InkBackdrop.vue in the medieval theme. -->
  <div class="medbd" :class="{ fixed }" aria-hidden="true">
    <span class="medbd-candle medbd-candle-a"></span>
    <span class="medbd-candle medbd-candle-b"></span>
    <span class="medbd-rose"></span>
    <span v-if="hills" class="medbd-country"></span>
    <span v-if="hills" class="medbd-haze"></span>
    <span v-for="i in 9" :key="i" class="medbd-mote" :style="{ '--i': i }"></span>
  </div>
</template>

<script setup>
defineProps({
  /** The far country of castles along the bottom. */
  hills: { type: Boolean, default: true },
  /** position: fixed (for scrolling pages) instead of absolute. */
  fixed: { type: Boolean, default: false }
})
</script>

<style scoped>
.medbd {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
  background-color: var(--bg);
  background-image:
    radial-gradient(ellipse 85% 70% at 45% 35%, rgba(255, 248, 228, 0.45), transparent 70%),
    radial-gradient(ellipse 120% 95% at 50% 45%, transparent 52%, rgba(90, 52, 16, 0.2)),
    var(--med-vellum, none);
  background-size:
    100% 100%,
    100% 100%,
    512px 512px;
}
.medbd.fixed {
  position: fixed;
}
/* candle glow: warm pools whose brightness gutters on an uneven cycle */
.medbd-candle {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(
    closest-side,
    rgba(255, 196, 96, 0.2),
    rgba(255, 180, 80, 0.07) 55%,
    transparent
  );
  animation:
    medbd-light 2.4s cubic-bezier(0.16, 0.8, 0.3, 1) both,
    medbd-gutter 5.3s ease-in-out 2.4s infinite;
}
.medbd-candle-a {
  width: 64vmax;
  height: 54vmax;
  left: -20vmax;
  top: -18vmax;
}
.medbd-candle-b {
  width: 50vmax;
  height: 42vmax;
  right: -16vmax;
  bottom: -8vmax;
  animation-delay: 0.25s, 3.1s;
  animation-duration: 2.4s, 6.7s;
}
@keyframes medbd-light {
  from {
    transform: scale(0.3);
    opacity: 0;
  }
}
@keyframes medbd-gutter {
  0%,
  100% {
    opacity: 1;
  }
  18% {
    opacity: 0.82;
  }
  24% {
    opacity: 0.95;
  }
  52% {
    opacity: 0.86;
  }
  70% {
    opacity: 1;
  }
}
/* the wind rose of a sea chart, turning once every few minutes */
.medbd-rose {
  position: absolute;
  right: -6vmin;
  top: -6vmin;
  width: min(58vmin, 520px);
  aspect-ratio: 1;
  background: var(--med-rose-color, none) center / contain no-repeat;
  opacity: 0.1;
  animation:
    medbd-rose-in 2.6s 0.2s var(--ease-out) both,
    medbd-turn 360s linear infinite;
}
@keyframes medbd-rose-in {
  from {
    opacity: 0;
  }
}
@keyframes medbd-turn {
  to {
    transform: rotate(1turn);
  }
}
.medbd-country {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: min(32vh, 280px);
  background: var(--med-skyline, none) center bottom / auto 100% repeat-x;
  opacity: 0.22;
  animation: medbd-rise 2s var(--ease-out) both;
}
@keyframes medbd-rise {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
}
.medbd-haze {
  position: absolute;
  left: -25%;
  right: -25%;
  bottom: 6vh;
  height: 13vh;
  background: radial-gradient(ellipse 50% 50% at 50% 50%, rgba(242, 229, 198, 0.75), transparent);
  animation: medbd-drift 18s ease-in-out infinite alternate;
}
@keyframes medbd-drift {
  from {
    transform: translateX(-8%);
  }
  to {
    transform: translateX(8%);
  }
}
/* dust motes rising through the light, each on its own slow path */
.medbd-mote {
  position: absolute;
  left: calc(var(--i) * 10.5% - 3%);
  bottom: 10%;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: rgba(255, 220, 150, 0.85);
  box-shadow: 0 0 6px rgba(255, 200, 110, 0.6);
  opacity: 0;
  animation: medbd-mote calc(14s + var(--i) * 1.7s) linear calc(var(--i) * -2.3s) infinite;
}
@keyframes medbd-mote {
  0% {
    transform: translate(0, 0);
    opacity: 0;
  }
  12% {
    opacity: 0.7;
  }
  50% {
    transform: translate(3vw, -40vh);
  }
  88% {
    opacity: 0.5;
  }
  100% {
    transform: translate(-1vw, -80vh);
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .medbd-candle,
  .medbd-rose,
  .medbd-country,
  .medbd-haze {
    animation: none;
  }
  .medbd-mote {
    display: none;
  }
}
</style>
