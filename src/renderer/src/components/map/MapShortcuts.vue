<template>
  <div class="msc-veil" @pointerdown.self="emit('close')" @wheel.stop>
    <section class="msc" role="dialog" :aria-label="t('map.keys.title')">
      <header class="msc-head">
        <UiIcon name="keyboard" :size="18" />
        <h2 class="msc-title">{{ t('map.keys.title') }}</h2>
        <button
          class="msc-x"
          :title="t('map.inspector.close')"
          :aria-label="t('map.inspector.close')"
          @click="emit('close')"
        >
          <UiIcon name="x" :size="16" />
        </button>
      </header>
      <div class="msc-cols">
        <div v-for="g in groups" :key="g.id" class="msc-group">
          <div class="msc-group-title">{{ t('map.keys.' + g.id) }}</div>
          <div v-for="row in g.rows" :key="row.label" class="msc-row">
            <span class="msc-label">{{ row.label }}</span>
            <span class="msc-keys">
              <template v-for="(k, i) in row.keys" :key="i">
                <span v-if="i" class="msc-or">/</span>
                <kbd>{{ k }}</kbd>
              </template>
            </span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from '../../i18n'
import UiIcon from '../ui/UiIcon.js'
import { ALL_TOOLS } from './mapKinds'

// The map's keyboard cheat sheet (press ?). Tool keys come straight from the
// tool catalog so the sheet can never drift from what the keys really do.
const emit = defineEmits(['close'])
const { t } = useI18n()

const mod = /Mac|iPhone|iPad/.test(navigator.platform || '') ? '⌘' : 'Ctrl'

const groups = computed(() => [
  {
    id: 'tools',
    rows: ALL_TOOLS.filter((tl) => tl.hotkey).map((tl) => ({
      label: t('map.tools.' + tl.id.replace(':', '_')),
      keys: [tl.hotkey.toUpperCase()]
    }))
  },
  {
    id: 'edit',
    rows: [
      { label: t('map.keys.undo'), keys: [mod + '+Z'] },
      { label: t('map.keys.redo'), keys: [mod + '+X', mod + '+Y'] },
      { label: t('map.keys.copy'), keys: [mod + '+C'] },
      { label: t('map.keys.paste'), keys: [mod + '+V'] },
      { label: t('map.keys.duplicate'), keys: [mod + '+D'] },
      { label: t('map.keys.delete'), keys: ['Del'] },
      { label: t('map.keys.nudge'), keys: ['← ↑ → ↓', 'Shift'] },
      { label: t('map.keys.finish'), keys: ['Enter'] },
      { label: t('map.keys.cancel'), keys: ['Esc'] },
      { label: t('map.keys.removePoint'), keys: ['Alt+click'] },
      { label: t('map.keys.noSnap'), keys: ['Alt'] }
    ]
  },
  {
    id: 'view',
    rows: [
      { label: t('map.keys.pan'), keys: ['Space+drag'] },
      { label: t('map.keys.zoom'), keys: ['+', '−'] },
      { label: t('map.keys.fit'), keys: ['0'] },
      { label: t('map.keys.find'), keys: [mod + '+F'] },
      { label: t('map.keys.people'), keys: ['G'] },
      { label: t('map.keys.play'), keys: ['P'] },
      { label: t('map.keys.step'), keys: ['[', ']'] },
      { label: t('map.keys.sheet'), keys: ['?'] }
    ]
  }
])
</script>

<style scoped>
.msc-veil {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.28);
  z-index: 45;
  animation: msc-fade var(--dur) ease;
}
@keyframes msc-fade {
  from {
    opacity: 0;
  }
}
.msc {
  width: min(860px, 100%);
  max-height: 100%;
  overflow-y: auto;
  padding: 16px 18px 18px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-xl);
  box-shadow: var(--shadow-lg);
  animation: msc-in var(--dur-slow) var(--ease-out);
}
@keyframes msc-in {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }
}
.msc-head {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--t1);
  margin-bottom: 12px;
}
.msc-title {
  flex: 1;
  margin: 0;
  font-size: var(--fs-lg);
  font-weight: 700;
}
.msc-x {
  width: var(--ctl-sm);
  height: var(--ctl-sm);
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--t3);
  cursor: pointer;
}
.msc-x:hover {
  background: var(--hover);
  color: var(--t1);
}
.msc-cols {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 18px;
}
.msc-group-title {
  font-size: var(--fs-xs);
  font-weight: 700;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  color: var(--t3);
  padding-bottom: 6px;
  margin-bottom: 4px;
  border-bottom: 1px solid var(--border);
}
.msc-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: var(--ctl-xs);
  font-size: var(--fs-md);
  color: var(--t2);
}
.msc-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.msc-keys {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
}
.msc-or {
  color: var(--t3);
  font-size: var(--fs-xs);
}
@media (prefers-reduced-motion: reduce) {
  .msc-veil,
  .msc {
    animation: none;
  }
}
</style>
