<template>
  <!-- A live miniature of the person's graph node: gender-gradient fill,
       optional portrait, breathing highlight ring, and the composed label. -->
  <div class="np">
    <div class="np-stage">
      <div v-if="ringColor != null" class="np-ring" :style="{ '--ring-c': ringCss }"></div>
      <div class="np-node" :style="{ '--node-c': color }">
        <img v-if="image" :src="image" class="np-img" alt="" />
        <span v-else class="np-glyph">{{ initial }}</span>
      </div>
    </div>
    <div :key="label || '·'" class="np-label">
      <span v-if="label">{{ label }}</span>
      <span v-else class="np-unnamed">Unnamed</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: { type: String, default: '' },
  color: { type: String, default: '#5c6bc0' },
  /** null = no ring; '' = ring in accent color; '#hex' = explicit color */
  ringColor: { type: null, default: null },
  image: { type: String, default: null }
})

const ringCss = computed(() => props.ringColor || 'var(--accent)')
const initial = computed(() => {
  const c = (props.label || '').trim()[0]
  return c ? c.toUpperCase() : '?'
})
</script>

<style scoped>
.np {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.np-stage {
  position: relative;
  width: 96px;
  height: 96px;
  display: grid;
  place-items: center;
}
.np-node {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: radial-gradient(
    circle at 32% 28%,
    color-mix(in srgb, var(--node-c) 72%, #ffffff),
    var(--node-c) 62%
  );
  display: grid;
  place-items: center;
  overflow: hidden;
  box-shadow: 0 6px 22px color-mix(in srgb, var(--node-c) 45%, transparent);
  transition:
    background 0.35s,
    box-shadow 0.35s;
}
.np-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.np-glyph {
  font-size: 26px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.92);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
}
.np-ring {
  position: absolute;
  inset: 4px;
  border-radius: 50%;
  border: 2.5px solid var(--ring-c);
  animation: np-breathe 2.4s ease-in-out infinite;
  pointer-events: none;
}
@keyframes np-breathe {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.9;
  }
  50% {
    transform: scale(1.08);
    opacity: 0.45;
  }
}
.np-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--t1);
  text-align: center;
  max-width: 200px;
  line-height: 1.45;
  animation: np-pop 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.np-unnamed {
  color: var(--t3);
  font-style: italic;
  font-weight: 500;
}
@keyframes np-pop {
  from {
    transform: scale(0.96);
    opacity: 0.6;
  }
}
@media (prefers-reduced-motion: reduce) {
  .np-ring,
  .np-label {
    animation: none;
  }
}
</style>
