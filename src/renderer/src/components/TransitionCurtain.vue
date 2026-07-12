<template>
  <div class="curtain" :class="'kind-' + kind" role="status" aria-live="polite">
    <!-- Drifting aurora backdrop (same visual family as AuthGate / UserPage) -->
    <div class="aurora">
      <span class="blob blob-a"></span>
      <span class="blob blob-b"></span>
      <span class="blob blob-c"></span>
    </div>

    <div class="stage">
      <!-- Emblem: a family-tree constellation that assembles, orbited by a
           conic loader ring. Doubles as the "still working" indicator. -->
      <div class="emblem">
        <span class="ring ring-outer"></span>
        <span class="ring ring-inner"></span>

        <svg class="graph" viewBox="0 0 220 220" aria-hidden="true">
          <!-- ring chords between neighbouring satellites -->
          <line
            v-for="(c, i) in chords"
            :key="'c' + i"
            class="chord"
            :x1="nodes[c[0]].x"
            :y1="nodes[c[0]].y"
            :x2="nodes[c[1]].x"
            :y2="nodes[c[1]].y"
            :style="{ animationDelay: 0.35 + i * 0.07 + 's' }"
          />
          <!-- spokes from the heart out to each person -->
          <line
            v-for="(n, i) in nodes"
            :key="'s' + i"
            class="spoke"
            x1="110"
            y1="110"
            :x2="n.x"
            :y2="n.y"
            :style="{ animationDelay: n.d + 's' }"
          />
          <!-- satellite people -->
          <circle
            v-for="(n, i) in nodes"
            :key="'n' + i"
            class="node"
            :cx="n.x"
            :cy="n.y"
            :r="n.r"
            :style="{ animationDelay: n.d + 0.1 + 's', '--tw': n.d + 's' }"
          />
          <!-- the heart -->
          <circle class="core-glow" cx="110" cy="110" r="30" />
          <circle class="core" cx="110" cy="110" r="20" />
        </svg>

        <span class="glyph">{{ glyph }}</span>
      </div>

      <div class="caption">
        <div class="label">{{ label }}</div>
        <div v-if="sub" class="sub">{{ sub }}</div>
        <div class="shimmer"><span></span></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  kind: { type: String, default: 'login' }, // login | logout | profile | switch
  label: { type: String, default: '' },
  sub: { type: String, default: '' }
})

// Six satellites on a hexagon (r≈74 around the 110,110 centre), alternating
// sizes, each with its own draw/pop delay for a staggered assemble.
const nodes = [
  { x: 184, y: 110, r: 12, d: 0.05 },
  { x: 147, y: 174.1, r: 9, d: 0.14 },
  { x: 73, y: 174.1, r: 12, d: 0.23 },
  { x: 36, y: 110, r: 9, d: 0.32 },
  { x: 73, y: 45.9, r: 12, d: 0.41 },
  { x: 147, y: 45.9, r: 9, d: 0.5 }
]
// Faint ring around the outside, drawn between neighbours.
const chords = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 0]
]

const GLYPHS = { login: '🌳', logout: '👋', profile: '👤', switch: '🗂️' }
const glyph = computed(() => GLYPHS[props.kind] || '🌳')
</script>

<style scoped>
.curtain {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  /* deep, slightly tinted backdrop that reads on both themes */
  background: radial-gradient(120% 120% at 50% 40%, var(--surface) 0%, var(--bg) 70%);
  /* per-kind accent drives every glow below */
  --cx: var(--accent);
}
.kind-login {
  --cx: #6c8ef5;
}
.kind-profile {
  --cx: #f06292;
}
.kind-switch {
  --cx: #f5a623;
}
.kind-logout {
  --cx: #8b6cc5;
}

/* ── Aurora backdrop ─────────────────────────────────────────────────────── */
.aurora {
  position: absolute;
  inset: 0;
  filter: blur(60px);
  opacity: 0.55;
  pointer-events: none;
}
.blob {
  position: absolute;
  width: 46vmax;
  height: 46vmax;
  border-radius: 50%;
  mix-blend-mode: screen;
}
.blob-a {
  top: -14%;
  left: -10%;
  background: radial-gradient(circle, var(--cx), transparent 62%);
  animation: drift-a 24s ease-in-out infinite;
}
.blob-b {
  bottom: -18%;
  right: -12%;
  background: radial-gradient(circle, var(--accent), transparent 62%);
  animation: drift-b 30s ease-in-out infinite;
}
.blob-c {
  top: 30%;
  right: 20%;
  width: 32vmax;
  height: 32vmax;
  background: radial-gradient(circle, var(--pink), transparent 60%);
  opacity: 0.6;
  animation: drift-c 36s ease-in-out infinite;
}
@keyframes drift-a {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  50% {
    transform: translate(8vw, 6vh) scale(1.15);
  }
}
@keyframes drift-b {
  0%,
  100% {
    transform: translate(0, 0) scale(1.1);
  }
  50% {
    transform: translate(-7vw, -5vh) scale(0.95);
  }
}
@keyframes drift-c {
  0%,
  100% {
    transform: translate(0, 0) scale(0.9);
  }
  50% {
    transform: translate(-5vw, 7vh) scale(1.2);
  }
}

/* ── Stage ───────────────────────────────────────────────────────────────── */
.stage {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 30px;
  animation: stage-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes stage-in {
  from {
    opacity: 0;
    transform: translateY(14px) scale(0.96);
  }
}

.emblem {
  position: relative;
  width: 220px;
  height: 220px;
  display: grid;
  place-items: center;
}

/* Conic loader rings orbiting the constellation */
.ring {
  position: absolute;
  border-radius: 50%;
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px));
  mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px));
}
.ring-outer {
  width: 210px;
  height: 210px;
  background: conic-gradient(from 0deg, transparent 0 55%, var(--cx) 90%, transparent);
  animation: spin 1.6s linear infinite;
  opacity: 0.9;
}
.ring-inner {
  width: 176px;
  height: 176px;
  background: conic-gradient(from 180deg, transparent 0 62%, var(--accent) 92%, transparent);
  animation: spin 2.4s linear infinite reverse;
  opacity: 0.5;
}
@keyframes spin {
  to {
    transform: rotate(1turn);
  }
}

/* The constellation itself, slowly turning */
.graph {
  position: absolute;
  width: 220px;
  height: 220px;
  transform-box: view-box;
  transform-origin: 110px 110px;
  animation: turn 26s linear infinite;
  overflow: visible;
}
.kind-logout .graph {
  animation-direction: reverse;
}
@keyframes turn {
  to {
    transform: rotate(1turn);
  }
}

.spoke {
  stroke: var(--cx);
  stroke-width: 1.6;
  opacity: 0.5;
  stroke-dasharray: 90;
  stroke-dashoffset: 90;
  animation: draw 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
.chord {
  stroke: var(--cx);
  stroke-width: 1;
  opacity: 0.2;
  stroke-dasharray: 80;
  stroke-dashoffset: 80;
  animation: draw 0.8s ease forwards;
}
@keyframes draw {
  to {
    stroke-dashoffset: 0;
  }
}

.node {
  fill: var(--surface);
  stroke: var(--cx);
  stroke-width: 2.5;
  transform-box: fill-box;
  transform-origin: center;
  transform: scale(0);
  animation:
    pop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) forwards,
    twinkle 2.6s ease-in-out infinite;
  animation-delay: inherit, var(--tw);
}
@keyframes pop {
  60% {
    transform: scale(1.18);
  }
  100% {
    transform: scale(1);
  }
}
@keyframes twinkle {
  0%,
  100% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
}

.core-glow {
  fill: var(--cx);
  opacity: 0.35;
  filter: blur(9px);
  transform-box: fill-box;
  transform-origin: center;
  animation: breathe 2.6s ease-in-out infinite;
}
.core {
  fill: var(--cx);
  filter: drop-shadow(0 0 10px var(--cx));
}
@keyframes breathe {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.3;
  }
  50% {
    transform: scale(1.35);
    opacity: 0.55;
  }
}

/* Emoji sits dead-centre, held steady while the graph spins under it */
.glyph {
  position: absolute;
  font-size: 30px;
  line-height: 1;
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.4));
  animation: glyph-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
.kind-logout .glyph {
  transform-origin: 70% 80%;
  animation:
    glyph-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both,
    wave 2.2s ease-in-out 0.6s infinite;
}
@keyframes glyph-pop {
  from {
    opacity: 0;
    transform: scale(0.2);
  }
}
@keyframes wave {
  0%,
  60%,
  100% {
    transform: rotate(0deg);
  }
  15%,
  45% {
    transform: rotate(16deg);
  }
  30% {
    transform: rotate(-8deg);
  }
}

/* ── Caption ─────────────────────────────────────────────────────────────── */
.caption {
  text-align: center;
  max-width: 320px;
}
.label {
  font-size: 19px;
  font-weight: 700;
  letter-spacing: 0.2px;
  color: var(--t1);
  animation: rise 0.5s 0.1s cubic-bezier(0.22, 1, 0.36, 1) both;
}
.sub {
  margin-top: 6px;
  font-size: 13px;
  color: var(--t2);
  animation: rise 0.5s 0.2s cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}

.shimmer {
  position: relative;
  width: 190px;
  height: 3px;
  margin: 16px auto 0;
  border-radius: 3px;
  background: var(--border);
  overflow: hidden;
}
.shimmer span {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 40%;
  border-radius: 3px;
  background: linear-gradient(90deg, transparent, var(--cx), transparent);
  animation: slide 1.3s ease-in-out infinite;
}
@keyframes slide {
  0% {
    transform: translateX(-120%);
  }
  100% {
    transform: translateX(360%);
  }
}

/* Respect reduced-motion: keep the piece legible, drop the spinning. */
@media (prefers-reduced-motion: reduce) {
  .aurora,
  .ring-outer,
  .ring-inner,
  .graph,
  .core-glow,
  .node,
  .glyph,
  .shimmer span {
    animation-duration: 0.001s !important;
    animation-iteration-count: 1 !important;
  }
  .shimmer span {
    animation: none;
    width: 100%;
    background: var(--cx);
    opacity: 0.6;
  }
}
</style>
