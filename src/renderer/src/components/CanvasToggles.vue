<template>
  <div class="ct-cluster" role="toolbar" aria-label="Canvas overlays">
    <!-- Overlay toggles: Focus / Legend / Relationships / Clean view -->
    <div class="ct-rail">
      <button
        v-for="(t, i) in buttons"
        :key="t.key"
        class="ct-btn"
        :class="{ on: t.active }"
        :style="{ '--tint': t.tint, '--i': i }"
        :title="t.title"
        :aria-pressed="t.active"
        @click="t.toggle"
      >
        <span class="ct-aura" aria-hidden="true"></span>
        <span class="ct-glyph">{{ t.icon }}</span>
        <span class="ct-dot" aria-hidden="true"></span>
      </button>
    </div>

    <!-- Selection tools: their own pill so the box/lasso radio pair reads as a
         different kind of control than the overlay toggles above. -->
    <div v-if="showMarquee" class="ct-rail ct-rail-tools">
      <span class="ct-rail-tag">Select</span>
      <button
        v-for="(t, i) in marqueeButtons"
        :key="t.key"
        class="ct-btn"
        :class="{ on: t.active }"
        :style="{ '--tint': t.tint, '--i': buttons.length + i }"
        :title="t.title"
        :aria-pressed="t.active"
        @click="t.toggle"
      >
        <span class="ct-aura" aria-hidden="true"></span>
        <span class="ct-glyph">{{ t.icon }}</span>
        <span class="ct-dot" aria-hidden="true"></span>
      </button>
    </div>

    <!-- Edit modes: the action wheel's slots, one click away (hold Tab for the
         radial version). The host view resolves the slots and owns the active
         mode; picking the running mode again turns it off. -->
    <div v-if="modes && modes.length" class="ct-rail ct-rail-modes">
      <span class="ct-rail-tag">Edit</span>
      <button
        v-for="(m, i) in modes"
        :key="m.id + ':' + i"
        class="ct-btn ct-btn-mode"
        :class="{ on: activeModeId === m.id, 'ct-locked': m.disabled }"
        :style="{ '--tint': m.color || 'var(--accent)', '--i': buttons.length + 2 + i }"
        :title="m.disabled ? m.disabledHint || m.label : `${m.label} — ${m.hint}`"
        :aria-pressed="activeModeId === m.id"
        @click="emit('pick-mode', m)"
      >
        <span class="ct-aura" aria-hidden="true"></span>
        <span class="ct-glyph">{{ m.icon }}</span>
        <span class="ct-dot" aria-hidden="true"></span>
      </button>
      <button
        class="ct-btn ct-btn-mode ct-btn-gear"
        :style="{ '--tint': 'var(--accent)', '--i': buttons.length + 2 + modes.length }"
        title="Customize edit modes (or hold Tab for the wheel)"
        @click="emit('config-modes')"
      >
        <span class="ct-glyph">⚙</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useMainStore } from '../store/index.js'

// The shared canvas-control cluster, dropped into the header of every spatial
// view (graph / timeline / groups). It renders up to three pills: the overlay
// toggles (Focus, Legend, Relationships open right-side panes the host view
// renders; Clean view — owned globally by the store — fades every canvas
// overlay away), the box/lasso selection-tool pair (`showMarquee`; the tool
// choice lives in the store so other spatial views can adopt the same marquee
// later), and the graph's edit modes (`modes` — the resolved action-wheel
// slots; the host handles `pick-mode` / `config-modes`). Each button carries
// its own tint so the cluster doubles as a colour key.
const props = defineProps({
  showFocus: { type: Boolean, default: false },
  showLegend: { type: Boolean, default: true },
  showRelTypes: { type: Boolean, default: false },
  showClean: { type: Boolean, default: true },
  showMarquee: { type: Boolean, default: false },
  focus: { type: Boolean, default: false },
  legend: { type: Boolean, default: false },
  relTypes: { type: Boolean, default: false },
  /** Resolved wheel slots ({ id, icon, color, label, hint, disabled… }) or null. */
  modes: { type: Array, default: null },
  activeModeId: { type: String, default: null }
})
const emit = defineEmits([
  'update:focus',
  'update:legend',
  'update:relTypes',
  'pick-mode',
  'config-modes'
])
const store = useMainStore()

const buttons = computed(() => {
  const list = []
  if (props.showFocus) {
    list.push({
      key: 'focus',
      icon: '🎯',
      title: 'Focus — highlight & emphasise people',
      tint: 'var(--accent)',
      active: props.focus,
      toggle: () => emit('update:focus', !props.focus)
    })
  }
  if (props.showLegend) {
    list.push({
      key: 'legend',
      icon: '🗺',
      title: 'Legend',
      tint: 'var(--green)',
      active: props.legend,
      toggle: () => emit('update:legend', !props.legend)
    })
  }
  if (props.showRelTypes) {
    list.push({
      key: 'relTypes',
      icon: '🔗',
      title: 'Relationships — types, weights & lenses',
      tint: 'var(--pink)',
      active: props.relTypes,
      toggle: () => emit('update:relTypes', !props.relTypes)
    })
  }
  if (props.showClean) {
    list.push({
      key: 'clean',
      icon: '✨',
      title: 'Clean view — hide canvas overlays',
      tint: 'var(--amber)',
      active: store.cleanView,
      toggle: () => (store.cleanView = !store.cleanView)
    })
  }
  return list
})

// A radio pair, not toggles: one selection tool is always armed.
const marqueeButtons = computed(() => [
  {
    key: 'box',
    icon: '▧',
    title: 'Box select — hold Shift and drag on the canvas',
    tint: 'var(--accent)',
    active: store.marqueeTool === 'box',
    toggle: () => (store.marqueeTool = 'box')
  },
  {
    key: 'lasso',
    icon: '◌',
    title: 'Lasso select — hold Shift and drag a freeform loop',
    tint: 'var(--accent)',
    active: store.marqueeTool === 'lasso',
    toggle: () => (store.marqueeTool = 'lasso')
  }
])
</script>

<style scoped>
.ct-cluster {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ct-rail {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border-radius: 13px;
  background: var(--glass-strong);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--border);
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.18);
  animation: ct-rail-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) backwards;
}
.ct-rail-tools {
  animation-delay: 0.08s;
}
.ct-rail-modes {
  animation-delay: 0.16s;
}
@keyframes ct-rail-in {
  from {
    opacity: 0;
    transform: translateY(-6px) scale(0.96);
  }
}

/* Tiny caption chip that names what a pill does */
.ct-rail-tag {
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 1.1px;
  text-transform: uppercase;
  color: var(--t3);
  padding: 0 3px 0 7px;
  user-select: none;
  writing-mode: horizontal-tb;
}

.ct-btn {
  position: relative;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--t2);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
  isolation: isolate;
  transition:
    background 0.18s ease,
    color 0.18s ease,
    transform 0.24s cubic-bezier(0.34, 1.55, 0.5, 1);
  animation: ct-btn-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) backwards;
  animation-delay: calc(var(--i) * 0.05s);
}
@keyframes ct-btn-in {
  from {
    opacity: 0;
    transform: translateY(-8px) scale(0.6);
  }
}
.ct-btn:hover {
  color: var(--t1);
  background: var(--hover);
  transform: translateY(-2px);
}
.ct-btn:active {
  transform: translateY(0) scale(0.9);
}

/* Edit-mode buttons: a touch smaller so eight of them stay compact */
.ct-btn-mode {
  width: 30px;
  height: 30px;
  border-radius: 9px;
}
.ct-btn-gear .ct-glyph {
  font-size: 13px;
  color: var(--t3);
}
.ct-btn-gear:hover .ct-glyph {
  color: var(--t1);
}
.ct-locked {
  opacity: 0.4;
}

.ct-glyph {
  position: relative;
  z-index: 2;
  font-size: 15px;
  line-height: 1;
  transition: transform 0.3s cubic-bezier(0.34, 1.6, 0.5, 1);
}
.ct-btn-mode .ct-glyph {
  font-size: 13.5px;
}
.ct-btn:hover .ct-glyph {
  transform: scale(1.14) rotate(-6deg);
}

/* ── Active state: tinted fill + glow + a slow rotating conic aura ring ─────── */
.ct-btn.on {
  color: color-mix(in srgb, var(--tint) 92%, white);
  background: color-mix(in srgb, var(--tint) 16%, transparent);
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--tint) 45%, transparent),
    0 0 16px color-mix(in srgb, var(--tint) 30%, transparent);
}
.ct-btn.on .ct-glyph {
  animation: ct-pop 0.42s cubic-bezier(0.34, 1.7, 0.4, 1);
}
@keyframes ct-pop {
  0% {
    transform: scale(0.7);
  }
  55% {
    transform: scale(1.28) rotate(8deg);
  }
  100% {
    transform: scale(1);
  }
}

/* The aura: a conic gradient ring, masked to the border, that only spins while
   active. Uses compositor-only rotation so it idles cheap. */
.ct-aura {
  position: absolute;
  inset: -2px;
  z-index: 1;
  border-radius: 12px;
  padding: 1.5px;
  background: conic-gradient(
    from 0deg,
    transparent 0deg,
    var(--tint) 90deg,
    transparent 200deg,
    var(--tint) 300deg,
    transparent 360deg
  );
  -webkit-mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  mask-composite: exclude;
  opacity: 0;
  transition: opacity 0.3s ease;
}
.ct-btn.on .ct-aura {
  opacity: 0.9;
  animation: ct-spin 3.6s linear infinite;
}
@keyframes ct-spin {
  to {
    transform: rotate(1turn);
  }
}

/* Pulsing status dot, top-right, only when active */
.ct-dot {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--tint);
  z-index: 3;
  transform: scale(0);
  transition: transform 0.3s cubic-bezier(0.34, 1.7, 0.4, 1);
}
.ct-btn.on .ct-dot {
  transform: scale(1);
  animation: ct-dot-pulse 1.8s ease-in-out infinite 0.3s;
}
@keyframes ct-dot-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--tint) 70%, transparent);
  }
  50% {
    box-shadow: 0 0 0 4px transparent;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ct-rail,
  .ct-btn,
  .ct-btn.on .ct-aura,
  .ct-btn.on .ct-dot {
    animation: none;
  }
}
</style>
