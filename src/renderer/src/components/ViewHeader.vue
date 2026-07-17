<template>
  <header class="vh">
    <div class="vh-heading">
      <span class="vh-icon" aria-hidden="true">{{ icon }}</span>
      <span class="vh-title">{{ title }}</span>
      <Transition name="vh-count" mode="out-in">
        <span v-if="count !== null" :key="count" class="vh-count">{{ count }}</span>
      </Transition>
      <span v-if="hint" class="vh-hint">{{ hint }}</span>
    </div>

    <div class="vh-actions">
      <slot />
    </div>

    <!-- animated gradient hairline -->
    <span class="vh-rule" aria-hidden="true"></span>
  </header>
</template>

<script setup>
// The consistent title header shared by the canvas views (graph, character),
// mirroring the DOM views' toolbars so every view reads the same. Left: a
// breathing view glyph + title + an animated count pill. Right: a slot for the
// shared CanvasToggles cluster (or any per-view controls).
defineProps({
  icon: { type: String, default: '' },
  title: { type: String, required: true },
  /** null = no count pill. */
  count: { type: [Number, null], default: null },
  hint: { type: String, default: '' }
})
</script>

<style scoped>
.vh {
  position: relative;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 22px;
  background: var(--glass-soft);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border);
  z-index: 6;
}

.vh-heading {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
}
.vh-icon {
  font-size: 19px;
  line-height: 1;
  transform-origin: 50% 60%;
  animation: vh-breathe 5.5s ease-in-out infinite;
  filter: drop-shadow(0 2px 6px rgba(108, 142, 245, 0.35));
}
@keyframes vh-breathe {
  0%,
  100% {
    transform: translateY(0) rotate(0deg) scale(1);
  }
  50% {
    transform: translateY(-2px) rotate(-4deg) scale(1.06);
  }
}
.vh-title {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.2px;
  color: var(--t1);
  white-space: nowrap;
  animation: vh-title-in 0.55s cubic-bezier(0.22, 1, 0.36, 1) backwards;
}
@keyframes vh-title-in {
  from {
    opacity: 0;
    transform: translateX(-8px);
  }
}
.vh-count {
  font-size: 12px;
  font-weight: 700;
  color: var(--accent);
  background: var(--adim);
  padding: 2px 9px;
  border-radius: 20px;
  min-width: 22px;
  text-align: center;
}
/* Count swaps with a springy pop whenever the number changes */
.vh-count-enter-active {
  transition:
    transform 0.32s cubic-bezier(0.34, 1.6, 0.5, 1),
    opacity 0.2s ease;
}
.vh-count-leave-active {
  transition:
    transform 0.16s ease,
    opacity 0.16s ease;
  position: absolute;
}
.vh-count-enter-from {
  transform: scale(0) translateY(-6px);
  opacity: 0;
}
.vh-count-leave-to {
  transform: scale(0.4);
  opacity: 0;
}
.vh-hint {
  font-size: 11.5px;
  color: var(--t3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-left: 4px;
}
.vh-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

/* A slow flowing gradient hairline that reads as "alive" without distracting */
.vh-rule {
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    color-mix(in srgb, var(--accent) 55%, transparent) 20%,
    color-mix(in srgb, var(--pink) 55%, transparent) 50%,
    color-mix(in srgb, var(--accent) 55%, transparent) 80%,
    transparent 100%
  );
  background-size: 220% 100%;
  opacity: 0.55;
  animation: vh-rule-flow 9s linear infinite;
}
@keyframes vh-rule-flow {
  to {
    background-position: 220% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .vh-icon,
  .vh-rule {
    animation: none;
  }
}
</style>
