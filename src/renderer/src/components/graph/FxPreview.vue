<template>
  <!-- A live CSS miniature of a line effect / lifeline look (the shader's own
       pigments), shared by the graph's Line Effects and the Timeline's Style pane. -->
  <span class="fx-prev" :class="'fx-prev-' + id" aria-hidden="true"></span>
</template>

<script setup>
defineProps({ id: { type: String, required: true } })
</script>

<style scoped>
/* Each tile's live preview strip — a CSS miniature of the shader effect.
   (Colours here are the effects' own pigments, like the shader palettes.) */
.fx-prev {
  position: relative;
  display: block;
  height: 10px;
  border-radius: 5px;
  overflow: hidden;
  background: var(--t3);
}
.fx-prev::before,
.fx-prev::after {
  content: '';
  position: absolute;
  inset: 0;
}
.fx-prev-none {
  height: 2px;
  margin: 4px 0;
  background: var(--t2);
}
.fx-prev-blood {
  background: linear-gradient(180deg, #4a030b, #b3121f 45%, #4a030b);
  animation: fxp-beat 1.1s ease-in-out infinite;
}
.fx-prev-blood::before {
  background: radial-gradient(ellipse 4px 3px at center, #ff7a6b 60%, transparent 70%) 0 50% / 14px
    100% repeat-x;
  animation: fxp-slide 0.9s linear infinite;
}
.fx-prev-river {
  background: linear-gradient(180deg, #0b3d63, #1d7fc0 50%, #0b3d63);
}
.fx-prev-river::before {
  background: repeating-linear-gradient(
    100deg,
    transparent 0 8px,
    rgba(210, 240, 255, 0.55) 8px 10px,
    transparent 10px 18px
  );
  background-size: 36px 100%;
  animation: fxp-slide 1.1s linear infinite;
}
.fx-prev-neon {
  background: #0b0f1c;
  box-shadow: inset 0 0 6px rgba(var(--accent-rgb), 0.9);
}
.fx-prev-neon::before {
  inset: 4px 0;
  background: #fff;
  box-shadow:
    0 0 6px var(--accent),
    0 0 12px var(--accent);
}
.fx-prev-neon::after {
  width: 18px;
  background: linear-gradient(90deg, transparent, #fff);
  box-shadow: 0 0 8px #fff;
  animation: fxp-race 0.8s linear infinite;
}
.fx-prev-helix {
  background: #121626;
}
.fx-prev-helix::before {
  background:
    repeating-linear-gradient(58deg, transparent 0 4px, #b07cf5 4px 6px, transparent 6px 12px),
    repeating-linear-gradient(-58deg, transparent 0 4px, #6fd3ff 4px 6px, transparent 6px 12px);
  background-size: 24px 100%;
  animation: fxp-slide 1.2s linear infinite;
}
.fx-prev-ember {
  background: linear-gradient(180deg, #3a0700, #e04a06 40%, #ffd06a 50%, #e04a06 60%, #3a0700);
  background-size: 100% 100%;
  animation: fxp-flicker 0.35s steps(2) infinite;
}
.fx-prev-ember::before {
  background: radial-gradient(circle 1.5px at center, #fff3c4 70%, transparent 80%) 0 0 / 11px 10px;
  animation: fxp-rise 0.8s linear infinite;
}
.fx-prev-aurora {
  background: linear-gradient(90deg, #26f29a, #8e5cff, #36c3ff, #26f29a);
  background-size: 200% 100%;
  filter: blur(0.6px) saturate(1.2);
  animation: fxp-shift 3s linear infinite;
}
.fx-prev-storm {
  background: #0e1230;
}
.fx-prev-storm::before {
  background: linear-gradient(
    90deg,
    transparent 0 10%,
    #dfe6ff 10% 12%,
    transparent 12% 46%,
    #b9c6ff 46% 48%,
    transparent 48% 80%,
    #ffffff 80% 82%,
    transparent 82%
  );
  animation: fxp-strike 0.9s steps(1) infinite;
}
.fx-prev-storm::after {
  inset: 4px 0;
  background: #8fa2ff;
  opacity: 0.5;
  box-shadow: 0 0 8px #8fa2ff;
}
.fx-prev-stars {
  background: #0c1024;
}
.fx-prev-stars::before {
  background: radial-gradient(circle 1.6px at center, #fff8e0 70%, transparent 80%) 0 0 / 13px 10px;
  animation: fxp-twinkle 1.4s ease-in-out infinite;
}
.fx-prev-stars::after {
  inset: 4.5px 0;
  background: rgba(255, 248, 224, 0.35);
}
.fx-prev-gilded {
  background: linear-gradient(180deg, #5b3a07, #f2c45a 50%, #5b3a07);
}
.fx-prev-gilded::before {
  background: linear-gradient(
    100deg,
    transparent 30%,
    rgba(255, 255, 255, 0.85) 45%,
    transparent 60%
  );
  background-size: 200% 100%;
  animation: fxp-shine 1.8s ease-in-out infinite;
}
@keyframes fxp-slide {
  to {
    background-position-x: 36px;
  }
}
@keyframes fxp-race {
  from {
    transform: translateX(-20px);
  }
  to {
    transform: translateX(140px);
  }
}
@keyframes fxp-beat {
  0%,
  70%,
  100% {
    filter: brightness(1);
  }
  15%,
  40% {
    filter: brightness(1.45);
  }
}
@keyframes fxp-flicker {
  50% {
    filter: brightness(1.25) hue-rotate(-8deg);
  }
}
@keyframes fxp-rise {
  to {
    background-position: 11px -10px;
  }
}
@keyframes fxp-shift {
  to {
    background-position-x: 200%;
  }
}
@keyframes fxp-strike {
  0%,
  48% {
    opacity: 1;
  }
  50%,
  100% {
    opacity: 0.1;
  }
}
@keyframes fxp-twinkle {
  50% {
    opacity: 0.35;
  }
}
@keyframes fxp-shine {
  from {
    background-position-x: 130%;
  }
  to {
    background-position-x: -30%;
  }
}

/* Timeline lifeline looks (vertical lifelines in the Timeline's Style pane). */
.fx-prev-classic {
  background: var(--t2);
}
.fx-prev-tube {
  background: linear-gradient(180deg, #2b4f9a, #8fb2ff 30%, #4b74d8 55%, #1d3570);
}
.fx-prev-glass {
  background: linear-gradient(
    180deg,
    rgba(150, 190, 255, 0.55),
    rgba(150, 190, 255, 0.15) 45%,
    rgba(150, 190, 255, 0.55)
  );
}
.fx-prev-glass::before {
  background: linear-gradient(
    90deg,
    transparent 30%,
    rgba(255, 255, 255, 0.85) 50%,
    transparent 70%
  );
  background-size: 300% 100%;
  animation: fxp-shine 2.2s linear infinite;
}
.fx-prev-glow {
  background: #6c8ef5;
  box-shadow: 0 0 8px #6c8ef5;
}
.fx-prev-glow::before {
  inset: 3px 0;
  border-radius: 3px;
  background: #fff;
  animation: fxp-flicker 2.4s ease-in-out infinite;
}
</style>
