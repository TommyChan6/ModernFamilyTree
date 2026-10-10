<template>
  <!-- Connection trace card: armed hint / the traced chain (with the kinship
       headline, arch & DNA) / a no-connection notice. Host-agnostic: the
       Timeline mounts it; the graph's own copy predates it. -->
  <Transition name="pathcard">
    <div v-if="anchorId && !info" key="armed" class="path-card path-armed">
      <span class="path-armed-beacon"></span>
      <span class="path-armed-name">{{ personName(anchorId) }}</span>
      <span class="path-armed-hint">{{ armedHint }}</span>
      <button class="path-close" title="Cancel (Esc)" aria-label="Cancel" @click="emit('close')">
        <UiIcon name="x" :size="14" />
      </button>
    </div>
    <div v-else-if="info && info.none" key="none" class="path-card path-none">
      <UiIcon class="path-none-icon" name="satellite" :size="16" />
      <span>
        No connection between <b>{{ personName(info.fromId) }}</b> and
        <b>{{ personName(info.toId) }}</b>
      </span>
      <button class="path-close" title="Dismiss (Esc)" aria-label="Dismiss" @click="emit('close')">
        <UiIcon name="x" :size="14" />
      </button>
    </div>
    <div v-else-if="info" key="path" class="path-card path-card-kin">
      <KinshipCard
        :key="info.ids[0] + '>' + info.ids[info.ids.length - 1]"
        :a="info.ids[0]"
        :b="info.ids[info.ids.length - 1]"
        @pick="emit('pick', $event)"
      />
      <div class="path-row">
        <div class="path-title">
          <UiIcon class="path-title-icon" name="compass" :size="14" />
          Connection
          <span class="path-count">
            {{ hops.length - 1 }} hop{{ hops.length > 2 ? 's' : '' }}
          </span>
        </div>
        <div class="path-chain">
          <template v-for="(hop, i) in hops" :key="hop.id">
            <div v-if="hop.via" class="path-via" :style="{ '--i': i * 2 - 1 }">
              <span class="path-via-label">
                <UiIcon v-if="hop.via.glyph" :name="hop.via.glyph" :size="12" />{{ hop.via.text }}
              </span>
              <span class="path-via-line"></span>
            </div>
            <button
              class="path-person"
              :style="{ '--i': i * 2, '--pc': hop.color }"
              :title="'View ' + hop.name"
              @click="emit('pick', hop.id)"
            >
              <span class="path-person-dot"></span>
              {{ hop.name }}
            </button>
          </template>
        </div>
      </div>
      <button class="path-close" title="Clear (Esc)" aria-label="Clear" @click="emit('close')">
        <UiIcon name="x" :size="14" />
      </button>
    </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue'
import { useMainStore } from '../../store/index.js'
import { nodeColor } from '../graph/linkHelpers.js'
import KinshipCard from './KinshipCard.vue'
import UiIcon from '../ui/UiIcon.js'

const props = defineProps({
  /** Armed: the first person, waiting for the second. */
  anchorId: { type: String, default: null },
  /** { ids, rels } | { none, fromId, toId } | null */
  info: { type: Object, default: null },
  armedHint: { type: String, default: 'shift-click another person to trace the connection' }
})
const emit = defineEmits(['close', 'pick'])
const store = useMainStore()

function personName(id) {
  return store.persons.find((p) => p.id === id)?.name || 'Unnamed'
}
function personColor(id) {
  const p = store.persons.find((x) => x.id === id)
  return p ? nodeColor(p.gender, store.graphSettings, p.gender_t) : 'var(--accent)'
}

/** The traced chain as displayable hops: person chips + the joining role label. */
const hops = computed(() => {
  const info = props.info
  if (!info || info.none) return []
  return info.ids.map((id, i) => {
    let via = null
    if (i > 0) {
      const r = info.rels[i - 1]
      const def = store.relTypeByKey.get(r.type)
      if (r.label) via = { text: r.label, glyph: def?.glyph || '' }
      else if (!def) via = { text: r.type, glyph: '' }
      else if (def.directed) {
        const prevIsA = r.person_a_id === info.ids[i - 1]
        via = { text: `${prevIsA ? def.role_a : def.role_b} of`, glyph: def.glyph }
      } else via = { text: def.label, glyph: def.glyph }
    }
    return { id, name: personName(id), color: personColor(id), via }
  })
})
</script>

<style scoped>
.path-card {
  position: absolute;
  left: 50%;
  bottom: 84px;
  transform: translateX(-50%);
  z-index: 7;
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: min(860px, calc(100% - 48px));
  padding: 11px 40px 11px 16px;
  border-radius: 16px;
  background: var(--glass-strong);
  backdrop-filter: blur(16px) saturate(1.25);
  -webkit-backdrop-filter: blur(16px) saturate(1.25);
  border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border));
  box-shadow:
    var(--shadow),
    0 0 34px color-mix(in srgb, var(--accent) 16%, transparent);
}
.path-card-kin {
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
  width: min(760px, calc(100% - 48px));
  max-height: calc(100% - 130px);
  overflow-y: auto;
  padding: 14px 40px 12px 18px;
}
.path-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 9px;
  border-top: 1px solid var(--border);
}
.path-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: var(--t3);
  white-space: nowrap;
}
.path-title-icon {
  animation: compass-wander 5s ease-in-out infinite;
}
@keyframes compass-wander {
  0%,
  100% {
    transform: rotate(0deg);
  }
  30% {
    transform: rotate(-22deg);
  }
  65% {
    transform: rotate(16deg);
  }
}
.path-count {
  font-size: 11px;
  font-weight: 700;
  color: var(--accent);
  background: var(--adim);
  padding: 1px 7px;
  border-radius: 12px;
  text-transform: none;
  letter-spacing: 0;
}
.path-chain {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
  min-width: 0;
}
.path-person {
  --pc: var(--accent);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 11px 4px 6px;
  border: 1px solid color-mix(in srgb, var(--pc) 45%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--pc) 12%, transparent);
  color: var(--t1);
  font-family: var(--font);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  animation: path-pop 0.5s cubic-bezier(0.3, 1.6, 0.4, 1) backwards;
  animation-delay: calc(var(--i) * 0.09s);
  transition:
    transform 0.18s cubic-bezier(0.34, 1.55, 0.5, 1),
    box-shadow 0.18s ease;
}
.path-person:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 14px color-mix(in srgb, var(--pc) 35%, transparent);
}
@keyframes path-pop {
  from {
    opacity: 0;
    transform: scale(0.4) translateY(8px);
  }
}
.path-person-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--pc);
  box-shadow: 0 0 8px color-mix(in srgb, var(--pc) 60%, transparent);
  flex-shrink: 0;
}
.path-via {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  animation: path-pop 0.5s cubic-bezier(0.3, 1.6, 0.4, 1) backwards;
  animation-delay: calc(var(--i) * 0.09s);
}
.path-via-label {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--t3);
  white-space: nowrap;
  letter-spacing: 0.02em;
}
.path-via-line {
  width: 34px;
  height: 2px;
  border-radius: 2px;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--accent) 15%, transparent),
    var(--accent),
    color-mix(in srgb, var(--accent) 15%, transparent)
  );
  background-size: 200% 100%;
  animation: path-stream 1.1s linear infinite;
}
@keyframes path-stream {
  from {
    background-position: 100% 0;
  }
  to {
    background-position: -100% 0;
  }
}
.path-close {
  position: absolute;
  top: 7px;
  right: 9px;
  width: var(--ctl-xs);
  height: var(--ctl-xs);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--t3);
  cursor: pointer;
  padding: 0;
  border-radius: 6px;
  transition:
    color 0.15s,
    background 0.15s;
}
.path-close:hover {
  color: var(--t1);
  background: var(--hover);
}
.path-armed {
  padding-right: 40px;
}
.path-armed-beacon {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
  animation: beacon 1.4s ease-out infinite;
}
@keyframes beacon {
  0% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 65%, transparent);
  }
  100% {
    box-shadow: 0 0 0 12px transparent;
  }
}
.path-armed-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--t1);
  white-space: nowrap;
}
.path-armed-hint {
  font-size: 12.5px;
  color: var(--t2);
}
.path-none {
  font-size: 12.5px;
  color: var(--t2);
  padding-right: 40px;
}
.path-none b {
  color: var(--t1);
}
.path-none-icon {
  flex-shrink: 0;
  color: var(--t3);
}
.pathcard-enter-active {
  transition:
    opacity 0.34s ease,
    transform 0.42s cubic-bezier(0.22, 1.3, 0.36, 1),
    filter 0.34s ease;
}
.pathcard-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.26s ease,
    filter 0.22s ease;
}
.pathcard-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(18px) scale(0.92);
  filter: blur(6px);
}
.pathcard-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(10px) scale(0.95);
  filter: blur(4px);
}
@media (prefers-reduced-motion: reduce) {
  .path-title-icon,
  .path-person,
  .path-via,
  .path-via-line,
  .path-armed-beacon {
    animation: none;
  }
}
</style>
