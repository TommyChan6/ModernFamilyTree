<template>
  <div class="vms" role="tablist" aria-label="Directory view mode">
    <div class="vms-thumb" :style="{ transform: `translateX(${activeIndex * 100}%)` }"></div>
    <button
      v-for="m in MODES"
      :key="m.id"
      class="vms-btn"
      :class="{ active: store.viewMode === m.id }"
      :title="m.label + ' — ' + m.blurb"
      @click="store.setViewMode(m.id)"
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <template v-if="m.id === 'grid'">
          <rect x="2" y="2" width="5.2" height="5.2" rx="1" />
          <rect x="8.8" y="2" width="5.2" height="5.2" rx="1" />
          <rect x="2" y="8.8" width="5.2" height="5.2" rx="1" />
          <rect x="8.8" y="8.8" width="5.2" height="5.2" rx="1" />
        </template>
        <template v-else-if="m.id === 'wheel'">
          <ellipse
            cx="8"
            cy="11.4"
            rx="6.2"
            ry="2.2"
            fill="none"
            stroke-width="1.3"
            class="vms-stroke"
          />
          <rect x="5.7" y="2.2" width="4.6" height="7" rx="0.9" />
        </template>
        <template v-else-if="m.id === 'flow'">
          <path d="M1.3 4.6l3.1-1.2v9.2l-3.1-1.2z" opacity="0.55" />
          <path d="M14.7 4.6l-3.1-1.2v9.2l3.1-1.2z" opacity="0.55" />
          <rect x="5.6" y="2.6" width="4.8" height="10.8" rx="1" />
        </template>
        <template v-else-if="m.id === 'fan'">
          <rect
            x="5.8"
            y="4.2"
            width="4.4"
            height="9.6"
            rx="0.9"
            transform="rotate(-26 8 14)"
            opacity="0.5"
          />
          <rect
            x="5.8"
            y="4.2"
            width="4.4"
            height="9.6"
            rx="0.9"
            transform="rotate(26 8 14)"
            opacity="0.5"
          />
          <rect x="5.8" y="2.8" width="4.4" height="10.4" rx="0.9" />
        </template>
        <template v-else>
          <rect
            x="3"
            y="4.6"
            width="8.6"
            height="10"
            rx="1.1"
            transform="rotate(-9 7.3 9.6)"
            opacity="0.45"
          />
          <rect x="5.2" y="2.4" width="8.6" height="10.6" rx="1.1" />
        </template>
      </svg>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useMainStore } from '../../store/index.js'

// Segmented switch for the Directory's viewing modes — the classic grid plus
// the CardStage layouts. A sliding thumb marks the active mode.

const store = useMainStore()

const MODES = [
  { id: 'grid', label: 'Grid', blurb: 'the classic scrolling wall of cards' },
  { id: 'wheel', label: 'Carousel', blurb: 'a 3D ring of cards — drag to spin it' },
  { id: 'flow', label: 'Flow', blurb: 'coverflow with floor reflections' },
  { id: 'fan', label: 'Hand', blurb: 'a fanned hand of cards' },
  { id: 'deck', label: 'Deck', blurb: 'swipe through the deck one card at a time' }
]

const activeIndex = computed(() =>
  Math.max(
    0,
    MODES.findIndex((m) => m.id === store.viewMode)
  )
)
</script>

<style scoped>
.vms {
  position: relative;
  display: flex;
  height: 36px;
  padding: 3px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--elevated);
}
.vms-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 34px;
  height: calc(100% - 6px);
  border-radius: 7px;
  background: var(--accent);
  box-shadow: 0 2px 10px rgba(108, 142, 245, 0.4);
  transition: transform 0.3s cubic-bezier(0.34, 1.4, 0.5, 1);
  pointer-events: none;
}
.vms-btn {
  position: relative;
  z-index: 1;
  width: 34px;
  border: none;
  background: transparent;
  color: var(--t3);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  transition:
    color 0.2s,
    transform 0.2s;
}
.vms-btn:hover {
  color: var(--t1);
  transform: translateY(-1px);
}
.vms-btn.active {
  color: #fff;
  transform: none;
}
.vms-btn svg {
  width: 16px;
  height: 16px;
  fill: currentColor;
}
.vms-stroke {
  stroke: currentColor;
}
</style>
