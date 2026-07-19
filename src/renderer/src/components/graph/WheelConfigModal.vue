<template>
  <Teleport to="body">
    <Transition name="wcfg">
      <div v-if="open" class="wcfg-backdrop" @click.self="emit('close')">
        <div
          class="wcfg-box"
          role="dialog"
          aria-modal="true"
          aria-label="Customize the action wheel"
        >
          <header class="wcfg-header">
            <div>
              <h2 class="wcfg-h2">Action wheel</h2>
              <p class="wcfg-sub">
                Hold <b>Tab</b> on the canvas, flick toward a mode, release. Pick a direction below
                and give it a job.
              </p>
            </div>
            <button class="wcfg-close" title="Close (Esc)" @click="emit('close')">×</button>
          </header>

          <div class="wcfg-body">
            <!-- ── Preview wheel: click a sector to edit that direction ────── -->
            <div class="wcfg-wheel-pane">
              <svg class="wcfg-wheel" viewBox="-104 -104 208 208">
                <circle class="wcfg-base" r="94" />
                <g
                  v-for="(s, i) in resolved"
                  :key="i"
                  class="wcfg-sector"
                  :class="{ on: i === sel, 'is-empty': s.empty }"
                  :style="{ '--sc': s.color || 'var(--accent)', '--i': i }"
                  @click="sel = i"
                >
                  <path class="wcfg-fill" :d="sectorPath(i, 32, 90)" />
                  <text
                    class="wcfg-ic"
                    :x="sectorCentroid(i, 61).x"
                    :y="sectorCentroid(i, 61).y"
                    text-anchor="middle"
                    dominant-baseline="central"
                  >
                    {{ s.empty ? '+' : s.icon }}
                  </text>
                </g>
                <text class="wcfg-hub-ic" text-anchor="middle" dominant-baseline="central">✥</text>
              </svg>
              <div class="wcfg-dir">
                <span class="wcfg-dir-badge">{{ WHEEL_DIRECTIONS[sel] }}</span>
                {{ resolved[sel].empty ? 'Empty slot' : resolved[sel].label }}
              </div>
            </div>

            <!-- ── Catalog for the selected direction ──────────────────────── -->
            <div class="wcfg-catalog">
              <section class="wcfg-group">
                <h3 class="wcfg-label">Mode</h3>
                <div class="wcfg-cards">
                  <button
                    v-for="c in coreCards"
                    :key="c.id"
                    class="wcfg-card"
                    :class="{ on: currentId === c.id }"
                    :style="{ '--sc': c.color || 'var(--accent)' }"
                    :title="c.hint"
                    @click="assign(c.slot)"
                  >
                    <span class="wcfg-card-ic">{{ c.icon }}</span>
                    <span class="wcfg-card-label">{{ c.label }}</span>
                  </button>
                </div>
              </section>

              <section class="wcfg-group">
                <h3 class="wcfg-label">Forge a bond</h3>
                <p class="wcfg-note">Click two people in a row and they're linked.</p>
                <div class="wcfg-chips">
                  <button
                    v-for="d in linkDefs"
                    :key="d.key"
                    class="wcfg-chip"
                    :class="{ on: currentId === 'link:' + d.key }"
                    :style="{ '--sc': typeColor(d) }"
                    @click="assign({ kind: 'link', type: d.key })"
                  >
                    <span class="wcfg-chip-glyph">{{ d.glyph }}</span
                    >{{ d.label }}
                  </button>
                </div>
              </section>

              <section v-if="store.caps.style !== 'none'" class="wcfg-group">
                <h3 class="wcfg-label">Paint nodes</h3>
                <div class="wcfg-swatches">
                  <button
                    v-for="c in WHEEL_PAINT_COLORS"
                    :key="c"
                    class="wcfg-swatch"
                    :class="{ on: currentId === 'paint:' + c }"
                    :style="{ background: c }"
                    :title="'Paint people ' + c"
                    @click="assign({ kind: 'paint', color: c })"
                  ></button>
                </div>
              </section>

              <section v-if="store.caps.tags && store.tags.length" class="wcfg-group">
                <h3 class="wcfg-label">Toggle a tag</h3>
                <div class="wcfg-chips">
                  <button
                    v-for="t in store.tags"
                    :key="t.id"
                    class="wcfg-chip"
                    :class="{ on: currentId === 'tag:' + t.id }"
                    :style="{ '--sc': t.color || 'var(--accent)' }"
                    @click="assign({ kind: 'tag', tagId: t.id })"
                  >
                    <span class="wcfg-chip-glyph">{{ t.icon || '🏷' }}</span
                    >{{ t.label }}
                  </button>
                </div>
              </section>
            </div>
          </div>

          <footer class="wcfg-footer">
            <button class="wcfg-btn" @click="resetDefaults">Reset to defaults</button>
            <button class="wcfg-btn wcfg-btn-primary" @click="emit('close')">Done</button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useMainStore } from '../../store/index.js'
import {
  DEFAULT_WHEEL_SLOTS,
  WHEEL_DIRECTIONS,
  WHEEL_PAINT_COLORS,
  WHEEL_SLOT_COUNT,
  resolveWheelSlots,
  sectorPath,
  sectorCentroid
} from './wheelModes.js'

const props = defineProps({
  open: { type: Boolean, default: false },
  initialSlot: { type: Number, default: null }
})
const emit = defineEmits(['close'])

const store = useMainStore()
const sel = ref(0)

watch(
  () => props.open,
  (o) => {
    if (o) sel.value = props.initialSlot ?? 0
  }
)

const env = computed(() => ({
  relTypeByKey: store.relTypeByKey,
  tagById: new Map(store.tags.map((t) => [t.id, t])),
  graphSettings: store.graphSettings,
  caps: store.caps,
  noun: store.noun
}))
const rawSlots = computed(() => {
  const s = store.wheelSlots
  return Array.isArray(s) && s.length === WHEEL_SLOT_COUNT
    ? JSON.parse(JSON.stringify(s))
    : JSON.parse(JSON.stringify(DEFAULT_WHEEL_SLOTS))
})
const resolved = computed(() => resolveWheelSlots(store.wheelSlots, env.value))
const currentId = computed(() => resolved.value[sel.value]?.id || 'empty')

const coreCards = computed(() => {
  const noun = store.noun.toLowerCase()
  return [
    { id: 'empty', slot: null, icon: '∅', label: 'Empty', color: null, hint: 'Nothing here' },
    {
      id: 'add',
      slot: { kind: 'add' },
      icon: '✚',
      label: `Add ${noun}`,
      color: '#4caf72',
      hint: `Click an empty spot to add a ${noun}`
    },
    {
      id: 'delete',
      slot: { kind: 'delete' },
      icon: '🗑',
      label: 'Delete',
      color: '#ef5350',
      hint: 'Click a node or bond, click again to confirm'
    },
    {
      id: 'pin',
      slot: { kind: 'pin' },
      icon: '📌',
      label: 'Pin',
      color: '#f5a623',
      hint: 'Click people to pin / release them'
    },
    {
      id: 'end',
      slot: { kind: 'end' },
      icon: '⌛',
      label: 'End bond',
      color: '#8a93a6',
      hint: 'Click a bond to mark it ended'
    },
    {
      id: 'swap',
      slot: { kind: 'swap' },
      icon: '⇄',
      label: 'Flip bond',
      color: '#26c6da',
      hint: 'Click a directed bond to reverse it'
    }
  ]
})

// Simple mode keeps the picker to the family band, same as the action pane.
const linkDefs = computed(() =>
  store.caps.relTypePicker ? store.relTypes : store.relTypes.filter((d) => d.band === 'family')
)
function typeColor(def) {
  const gs = store.graphSettings
  if (def.key === 'spouse') return gs.spouseColor
  if (def.key === 'adopted') return gs.adoptedColor
  if (def.key === 'parent_child') return gs.parentChildColor
  return def.color || gs.parentChildColor
}

function assign(slot) {
  const next = rawSlots.value
  next[sel.value] = slot ? JSON.parse(JSON.stringify(slot)) : null
  store.setWheelSlots(next)
}

function resetDefaults() {
  store.setWheelSlots(null)
}
</script>

<style scoped>
.wcfg-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(8, 10, 18, 0.55);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
}
.wcfg-box {
  width: min(680px, calc(100vw - 48px));
  max-height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 18px;
  box-shadow: var(--shadow);
  overflow: hidden;
}
/* Signature accent shimmer along the top edge (same language as the panes). */
.wcfg-box::before {
  content: '';
  display: block;
  height: 1px;
  margin: 0 10%;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  opacity: 0.55;
}

.wcfg-enter-active {
  transition: opacity 0.22s ease;
}
.wcfg-enter-active .wcfg-box {
  transition:
    transform 0.34s cubic-bezier(0.22, 1.3, 0.36, 1),
    opacity 0.22s ease;
}
.wcfg-leave-active {
  transition: opacity 0.16s ease;
}
.wcfg-leave-active .wcfg-box {
  transition: transform 0.16s ease;
}
.wcfg-enter-from,
.wcfg-leave-to {
  opacity: 0;
}
.wcfg-enter-from .wcfg-box {
  transform: translateY(22px) scale(0.94);
}
.wcfg-leave-to .wcfg-box {
  transform: translateY(10px) scale(0.97);
}

.wcfg-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px 10px;
}
.wcfg-h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--t1);
}
.wcfg-sub {
  margin: 3px 0 0;
  font-size: 11.5px;
  color: var(--t3);
}
.wcfg-sub b {
  color: var(--t2);
}
.wcfg-close {
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--t3);
  font-size: 16px;
  cursor: pointer;
  transition:
    background 0.12s,
    color 0.12s;
}
.wcfg-close:hover {
  background: var(--hover);
  color: var(--t1);
}

.wcfg-body {
  display: flex;
  gap: 18px;
  padding: 8px 20px 14px;
  overflow: hidden;
  min-height: 0;
}

/* ── Preview wheel ─────────────────────────────────────────────────────── */
.wcfg-wheel-pane {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.wcfg-wheel {
  width: 224px;
  height: 224px;
}
.wcfg-base {
  fill: var(--glass-strong);
  stroke: var(--border);
}
.wcfg-sector {
  cursor: pointer;
  transition: transform 0.2s cubic-bezier(0.34, 1.55, 0.5, 1);
  animation: wcfg-in 0.4s cubic-bezier(0.22, 1.35, 0.36, 1) backwards;
  animation-delay: calc(var(--i) * 0.03s);
}
@keyframes wcfg-in {
  from {
    transform: scale(0.5);
    opacity: 0;
  }
}
.wcfg-fill {
  fill: color-mix(in srgb, var(--surface) 55%, transparent);
  stroke: var(--border);
  transition:
    fill 0.16s ease,
    stroke 0.16s ease;
}
.wcfg-sector:hover .wcfg-fill {
  fill: color-mix(in srgb, var(--sc) 14%, var(--surface));
}
.wcfg-sector.on {
  transform: scale(1.04);
}
.wcfg-sector.on .wcfg-fill {
  fill: color-mix(in srgb, var(--sc) 26%, var(--surface));
  stroke: color-mix(in srgb, var(--sc) 65%, transparent);
  filter: drop-shadow(0 0 10px color-mix(in srgb, var(--sc) 40%, transparent));
}
.wcfg-sector.is-empty .wcfg-fill {
  fill: transparent;
  stroke-dasharray: 4 5;
}
.wcfg-ic {
  font-size: 15px;
  fill: var(--t2);
  pointer-events: none;
  user-select: none;
}
.wcfg-hub-ic {
  font-size: 15px;
  fill: var(--t3);
}
.wcfg-dir {
  font-size: 11px;
  font-weight: 600;
  color: var(--t2);
  display: flex;
  align-items: center;
  gap: 6px;
}
.wcfg-dir-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  padding: 1px 5px;
  border-radius: 6px;
  background: var(--adim);
  color: var(--accent);
  font-size: 10px;
  font-weight: 700;
}

/* ── Catalog ───────────────────────────────────────────────────────────── */
.wcfg-catalog {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-right: 4px;
}
.wcfg-label {
  margin: 0 0 6px;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--t3);
}
.wcfg-note {
  margin: -4px 0 6px;
  font-size: 10.5px;
  color: var(--t3);
}
.wcfg-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}
.wcfg-card {
  --sc: var(--accent);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 8px 4px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: transparent;
  color: var(--t2);
  font-family: var(--font);
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    transform 0.18s cubic-bezier(0.34, 1.5, 0.5, 1),
    box-shadow 0.18s ease;
}
.wcfg-card:hover {
  transform: translateY(-1.5px);
  border-color: color-mix(in srgb, var(--sc) 40%, var(--border));
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
.wcfg-card.on {
  background: color-mix(in srgb, var(--sc) 12%, transparent);
  border-color: color-mix(in srgb, var(--sc) 55%, transparent);
  color: var(--t1);
}
.wcfg-card-ic {
  font-size: 15px;
}
.wcfg-card-label {
  font-size: 10px;
  font-weight: 600;
}

.wcfg-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.wcfg-chip {
  --sc: var(--accent);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 9px;
  border: 1px solid color-mix(in srgb, var(--sc) 28%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--sc) 8%, transparent);
  color: var(--t2);
  font-family: var(--font);
  font-size: 10.5px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    transform 0.18s cubic-bezier(0.34, 1.5, 0.5, 1);
}
.wcfg-chip:hover {
  background: color-mix(in srgb, var(--sc) 18%, transparent);
  color: var(--t1);
  transform: translateY(-1.5px);
}
.wcfg-chip.on {
  background: color-mix(in srgb, var(--sc) 24%, transparent);
  color: var(--t1);
  border-color: color-mix(in srgb, var(--sc) 60%, transparent);
}
.wcfg-chip-glyph {
  color: var(--sc);
  font-size: 11px;
}

.wcfg-swatches {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.wcfg-swatch {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid transparent;
  padding: 0;
  cursor: pointer;
  transition:
    transform 0.16s cubic-bezier(0.34, 1.6, 0.64, 1),
    border-color 0.16s ease,
    box-shadow 0.16s ease;
}
.wcfg-swatch:hover {
  transform: scale(1.18);
}
.wcfg-swatch.on {
  border-color: var(--t1);
  transform: scale(1.1);
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.3);
}

.wcfg-footer {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 20px 16px;
  border-top: 1px solid var(--border);
}
.wcfg-btn {
  padding: 7px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: transparent;
  color: var(--t2);
  font-family: var(--font);
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    transform 0.18s cubic-bezier(0.34, 1.5, 0.5, 1);
}
.wcfg-btn:hover {
  background: var(--hover);
  color: var(--t1);
  transform: translateY(-1px);
}
.wcfg-btn-primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.wcfg-btn-primary:hover {
  background: color-mix(in srgb, var(--accent) 88%, #fff);
  color: #fff;
}

@media (prefers-reduced-motion: reduce) {
  .wcfg-sector {
    animation: none;
  }
}
</style>
