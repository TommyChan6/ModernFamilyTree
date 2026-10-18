<template>
  <div
    ref="el"
    class="mcm"
    role="menu"
    :style="{ left: pos.x + 'px', top: pos.y + 'px' }"
    @pointerdown.stop
    @wheel.stop
    @contextmenu.prevent
  >
    <div v-if="title" class="mcm-title">{{ title }}</div>
    <template v-for="it in items" :key="it.id">
      <div v-if="it.sep" class="mcm-sep"></div>
      <button
        v-else
        class="mcm-item"
        :class="{ danger: it.danger }"
        role="menuitem"
        :disabled="it.disabled"
        @click="emit('pick', it.id)"
      >
        <UiIcon class="mcm-icon" :name="it.icon" :size="16" />
        <span class="mcm-label">{{ it.label }}</span>
        <kbd v-if="it.kbd" class="mcm-kbd">{{ it.kbd }}</kbd>
      </button>
    </template>
  </div>
</template>

<script setup>
import { nextTick, onMounted, ref } from 'vue'
import UiIcon from '../ui/UiIcon.js'

// The map's right-click menu: what you can do with the thing under the
// pointer (a feature, a vertex, a person, or the empty map). Items arrive
// ready-translated from MapView; the menu only positions itself inside the
// stage and reports the pick.
const props = defineProps({
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  title: { type: String, default: '' },
  /** [{ id, icon, label, kbd?, danger?, disabled? } | { id, sep: true }] */
  items: { type: Array, required: true },
  /** Stage size, so the menu flips to stay on screen. */
  bounds: { type: Object, required: true }
})
const emit = defineEmits(['pick'])

const el = ref(null)
const pos = ref({ x: props.x, y: props.y })

onMounted(async () => {
  await nextTick()
  const r = el.value?.getBoundingClientRect()
  if (!r) return
  const { w, h } = props.bounds
  pos.value = {
    x: props.x + r.width + 8 > w ? Math.max(8, props.x - r.width) : props.x,
    y: props.y + r.height + 8 > h ? Math.max(8, h - r.height - 8) : props.y
  }
  el.value.querySelector('.mcm-item:not(:disabled)')?.focus({ preventScroll: true })
})
</script>

<style scoped>
.mcm {
  position: absolute;
  min-width: 210px;
  padding: 6px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow);
  z-index: 40;
  display: flex;
  flex-direction: column;
  gap: 1px;
  transform-origin: top left;
  animation: mcm-in var(--dur) var(--ease-out);
}
@keyframes mcm-in {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
}
.mcm-title {
  font-size: var(--fs-xs);
  font-weight: 700;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  color: var(--t3);
  padding: 4px 8px 4px;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mcm-item {
  display: flex;
  align-items: center;
  gap: 9px;
  height: var(--ctl-md);
  padding: 0 9px;
  border: none;
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--t1);
  font-family: var(--font);
  font-size: var(--fs-md);
  text-align: left;
  cursor: pointer;
}
.mcm-item:hover:not(:disabled),
.mcm-item:focus-visible {
  background: var(--hover);
  outline: none;
}
.mcm-item:disabled {
  color: var(--t3);
  cursor: default;
}
.mcm-item.danger {
  color: var(--danger);
}
.mcm-item.danger:hover {
  background: rgba(var(--danger-rgb), 0.14);
}
.mcm-icon {
  flex: 0 0 auto;
}
.mcm-label {
  flex: 1;
  white-space: nowrap;
}
.mcm-kbd {
  font-family: var(--font);
  font-size: var(--fs-xs);
  color: var(--t3);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0 5px;
}
.mcm-sep {
  height: 1px;
  background: var(--border);
  margin: 4px 2px;
}
@media (prefers-reduced-motion: reduce) {
  .mcm {
    animation: none;
  }
}
</style>
