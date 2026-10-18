<template>
  <div class="ct-cluster" role="toolbar" :aria-label="t('graph.toggles.aria')">
    <!-- Overlay toggles: Focus / Legend / Relationships / Clean view -->
    <div class="ct-rail">
      <button
        v-for="(btn, i) in buttons"
        :key="btn.key"
        class="ct-btn"
        :class="{ on: btn.active }"
        :style="{ '--tint': btn.tint, '--i': i }"
        :title="btn.title"
        :aria-label="btn.title"
        :aria-pressed="btn.active"
        @click="btn.toggle"
      >
        <span class="ct-aura" aria-hidden="true"></span>
        <UiIcon class="ct-glyph" :name="btn.icon" :size="16" />
        <span class="ct-dot" aria-hidden="true"></span>
      </button>
    </div>

    <!-- Selection tools: their own pill so the box/lasso radio pair reads as a
         different kind of control than the overlay toggles above. -->
    <div v-if="showMarquee" class="ct-rail ct-rail-tools">
      <span class="ct-rail-tag">{{ t('graph.toggles.select') }}</span>
      <button
        v-for="(btn, i) in marqueeButtons"
        :key="btn.key"
        class="ct-btn"
        :class="{ on: btn.active }"
        :style="{ '--tint': btn.tint, '--i': buttons.length + i }"
        :title="btn.title"
        :aria-label="btn.title"
        :aria-pressed="btn.active"
        @click="btn.toggle"
      >
        <span class="ct-aura" aria-hidden="true"></span>
        <UiIcon class="ct-glyph" :name="btn.icon" :size="16" />
        <span class="ct-dot" aria-hidden="true"></span>
      </button>
    </div>

    <!-- Edit modes: the action wheel's slots, one click away (hold Tab for the
         radial version). The host view resolves the slots and owns the active
         mode; picking the running mode again turns it off. -->
    <div v-if="modes && modes.length" class="ct-rail ct-rail-modes">
      <span class="ct-rail-tag">{{ t('graph.toggles.edit') }}</span>
      <button
        v-for="(m, i) in modes"
        :key="m.id + ':' + i"
        class="ct-btn ct-btn-mode"
        :class="{ on: activeModeId === m.id, 'ct-locked': m.disabled }"
        :style="{ '--tint': m.color || 'var(--accent)', '--i': buttons.length + 2 + i }"
        :title="m.disabled ? m.disabledHint || m.label : t('graph.toggles.modeTitle', m)"
        :aria-label="m.label"
        :aria-pressed="activeModeId === m.id"
        @click="emit('pick-mode', m)"
      >
        <span class="ct-aura" aria-hidden="true"></span>
        <UiIcon class="ct-glyph" :name="m.icon" :size="16" />
        <span class="ct-dot" aria-hidden="true"></span>
      </button>
      <button
        v-if="modeGear"
        class="ct-btn ct-btn-mode ct-btn-gear"
        :style="{ '--tint': 'var(--accent)', '--i': buttons.length + 2 + modes.length }"
        :title="t('graph.toggles.gear')"
        :aria-label="t('graph.toggles.gearAria')"
        @click="emit('config-modes')"
      >
        <UiIcon class="ct-glyph" name="settings" :size="16" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useMainStore } from '../store/index.js'
import UiIcon from './ui/UiIcon.js'
import { useI18n } from '../i18n'

// The shared canvas-control cluster, dropped into the header of every spatial
// view (graph / timeline / groups). It renders up to three pills: the overlay
// toggles (Focus, Legend, Relationships open right-side panes the host view
// renders; Time drag lets vertical drags retime lives — the host owns it;
// Clean view — owned globally by the store — fades every canvas
// overlay away), the box/lasso selection-tool pair (`showMarquee`; the tool
// choice lives in the store so other spatial views can adopt the same marquee
// later), and the graph's edit modes (`modes` — the resolved action-wheel
// slots; the host handles `pick-mode` / `config-modes`). Each button carries
// its own tint so the cluster doubles as a colour key.
const props = defineProps({
  showFocus: { type: Boolean, default: false },
  showLegend: { type: Boolean, default: true },
  showRelTypes: { type: Boolean, default: false },
  showKinship: { type: Boolean, default: false },
  showChronicle: { type: Boolean, default: false },
  showStyle: { type: Boolean, default: false },
  showClean: { type: Boolean, default: true },
  showTimeDrag: { type: Boolean, default: false },
  showMarquee: { type: Boolean, default: false },
  focus: { type: Boolean, default: false },
  legend: { type: Boolean, default: false },
  relTypes: { type: Boolean, default: false },
  kinship: { type: Boolean, default: false },
  chronicle: { type: Boolean, default: false },
  stylePane: { type: Boolean, default: false },
  timeDrag: { type: Boolean, default: false },
  /** Resolved wheel slots ({ id, icon, color, label, hint, disabled… }) or null. */
  modes: { type: Array, default: null },
  activeModeId: { type: String, default: null },
  /** Show the gear (customize the wheel) after the edit modes. */
  modeGear: { type: Boolean, default: true }
})
const emit = defineEmits([
  'update:focus',
  'update:legend',
  'update:relTypes',
  'update:kinship',
  'update:chronicle',
  'update:stylePane',
  'update:timeDrag',
  'pick-mode',
  'config-modes'
])
const store = useMainStore()
const { t } = useI18n()

const buttons = computed(() => {
  const list = []
  if (props.showFocus) {
    list.push({
      key: 'focus',
      icon: 'target',
      title: t('graph.toggles.focus'),
      tint: 'var(--accent)',
      active: props.focus,
      toggle: () => emit('update:focus', !props.focus)
    })
  }
  if (props.showLegend) {
    list.push({
      key: 'legend',
      icon: 'map',
      title: t('graph.toggles.legend'),
      tint: 'var(--green)',
      active: props.legend,
      toggle: () => emit('update:legend', !props.legend)
    })
  }
  if (props.showRelTypes) {
    list.push({
      key: 'relTypes',
      icon: 'link',
      title: t('graph.toggles.relTypes'),
      tint: 'var(--pink)',
      active: props.relTypes,
      toggle: () => emit('update:relTypes', !props.relTypes)
    })
  }
  if (props.showChronicle) {
    list.push({
      key: 'chronicle',
      icon: 'scroll-text',
      title: t('graph.toggles.chronicle'),
      tint: 'var(--kin-blood)',
      active: props.chronicle,
      toggle: () => emit('update:chronicle', !props.chronicle)
    })
  }
  if (props.showStyle) {
    list.push({
      key: 'style',
      icon: 'palette',
      title: t('graph.toggles.style'),
      tint: 'var(--accent-2)',
      active: props.stylePane,
      toggle: () => emit('update:stylePane', !props.stylePane)
    })
  }
  if (props.showKinship) {
    list.push({
      key: 'kinship',
      icon: 'dna',
      title: t('graph.toggles.kinship'),
      tint: 'var(--kin-blood)',
      active: props.kinship,
      toggle: () => emit('update:kinship', !props.kinship)
    })
  }
  if (props.showTimeDrag) {
    list.push({
      key: 'timeDrag',
      icon: 'calendar-clock',
      title: t('graph.toggles.timeDrag'),
      tint: 'var(--accent)',
      active: props.timeDrag,
      toggle: () => emit('update:timeDrag', !props.timeDrag)
    })
  }
  if (props.showClean) {
    list.push({
      key: 'clean',
      icon: 'sparkles',
      title: t('graph.toggles.clean'),
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
    icon: 'square-dashed',
    title: t('graph.toggles.box'),
    tint: 'var(--accent)',
    active: store.marqueeTool === 'box',
    toggle: () => (store.marqueeTool = 'box')
  },
  {
    key: 'lasso',
    icon: 'lasso',
    title: t('graph.toggles.lasso'),
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
  font-size: var(--fs-xs);
  font-weight: 800;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  color: var(--t3);
  padding: 0 3px 0 7px;
  user-select: none;
  writing-mode: horizontal-tb;
}

.ct-btn {
  position: relative;
  flex: none;
  width: var(--ctl-md);
  height: var(--ctl-md);
  padding: 0;
  border: none;
  border-radius: 9px;
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

.ct-btn-gear .ct-glyph {
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
  flex: none;
  transition: transform 0.3s cubic-bezier(0.34, 1.6, 0.5, 1);
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
  border-radius: 11px;
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
