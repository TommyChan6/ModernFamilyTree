<template>
  <nav class="mtb" @pointerdown.stop @wheel.stop>
    <div v-for="g in TOOL_GROUPS" :key="g.id" class="mtb-group" @mouseleave="closeSoon(g.id)">
      <button
        class="mtb-btn"
        :class="{ active: groupOf(tool) === g.id, open: openGroup === g.id }"
        :title="groupTitle(g)"
        @click="onGroupClick(g)"
        @mouseenter="hoverOpen(g)"
      >
        <span class="mtb-icon">{{ face(g).icon }}</span>
        <span v-if="g.tools.length > 1" class="mtb-more">◢</span>
      </button>
      <Transition name="mtb-fly">
        <div
          v-if="openGroup === g.id && g.tools.length > 1"
          class="mtb-fly"
          @mouseenter="cancelClose"
        >
          <div class="mtb-fly-title">{{ t('map.groups.' + g.id) }}</div>
          <div class="mtb-fly-grid" :class="{ wide: g.tools.length > 6 }">
            <button
              v-for="(tl, i) in g.tools"
              :key="tl.id"
              class="mtb-tool"
              :class="{ active: tool === tl.id }"
              :style="{ '--i': i }"
              @click="pick(g, tl)"
            >
              <span class="mtb-tool-icon">{{ tl.icon }}</span>
              <span class="mtb-tool-name">{{ toolName(tl.id) }}</span>
              <kbd v-if="tl.hotkey" class="mtb-kbd">{{ tl.hotkey.toUpperCase() }}</kbd>
            </button>
          </div>
        </div>
      </Transition>
    </div>
    <div class="mtb-sep"></div>
    <button
      class="mtb-btn"
      :class="{ active: peopleOpen }"
      :title="t('map.people.toggle')"
      @click="emit('toggle-people')"
    >
      <span class="mtb-icon">👥</span>
    </button>
  </nav>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useI18n } from '../../i18n'
import { TOOL_GROUPS } from './mapKinds'

// The Map view's left tool palette. Each group shows its last-used tool as
// its face; hovering (or clicking an active group) opens a labelled flyout
// with every tool and its hotkey, so nothing is hidden behind a mystery icon.
const props = defineProps({
  tool: { type: String, required: true },
  peopleOpen: { type: Boolean, default: false }
})
const emit = defineEmits(['update:tool', 'toggle-people'])
const { t } = useI18n()

const openGroup = ref(null)
const lastInGroup = reactive({})
let closeTimer = null
let openTimer = null

function groupOf(toolId) {
  return TOOL_GROUPS.find((g) => g.tools.some((tl) => tl.id === toolId))?.id
}
function face(g) {
  const id = lastInGroup[g.id] || (groupOf(props.tool) === g.id ? props.tool : null)
  return g.tools.find((tl) => tl.id === id) || g.tools[0]
}
function toolName(id) {
  return t('map.tools.' + id.replace(':', '_'))
}
function groupTitle(g) {
  const f = face(g)
  return `${t('map.groups.' + g.id)} — ${toolName(f.id)}${f.hotkey ? ` (${f.hotkey.toUpperCase()})` : ''}`
}
function onGroupClick(g) {
  const f = face(g)
  if (groupOf(props.tool) === g.id && g.tools.length > 1) {
    openGroup.value = openGroup.value === g.id ? null : g.id
    return
  }
  emit('update:tool', f.id)
  openGroup.value = g.tools.length > 1 ? g.id : null
}
function hoverOpen(g) {
  cancelClose()
  clearTimeout(openTimer)
  if (g.tools.length < 2) {
    openGroup.value = null
    return
  }
  openTimer = setTimeout(() => (openGroup.value = g.id), openGroup.value ? 0 : 260)
}
function pick(g, tl) {
  lastInGroup[g.id] = tl.id
  emit('update:tool', tl.id)
  openGroup.value = null
}
function closeSoon(id) {
  clearTimeout(openTimer)
  clearTimeout(closeTimer)
  closeTimer = setTimeout(() => {
    if (openGroup.value === id) openGroup.value = null
  }, 240)
}
function cancelClose() {
  clearTimeout(closeTimer)
}
/** Remember a hotkey-picked tool as its group's face too. */
function remember(toolId) {
  const g = groupOf(toolId)
  if (g) lastInGroup[g] = toolId
}
defineExpose({ remember })
</script>

<style scoped>
.mtb {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  background: var(--glass-strong);
  backdrop-filter: blur(14px) saturate(1.3);
  -webkit-backdrop-filter: blur(14px) saturate(1.3);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow);
  z-index: 9;
  animation: mtb-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) backwards;
}
@keyframes mtb-in {
  from {
    opacity: 0;
    transform: translate(-20px, -50%);
  }
}
.mtb-group {
  position: relative;
}
.mtb-btn {
  position: relative;
  width: 42px;
  height: 42px;
  border: none;
  border-radius: 11px;
  background: transparent;
  color: var(--t1);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition:
    background 0.15s,
    transform 0.15s;
}
.mtb-btn:hover {
  background: var(--hover);
  transform: scale(1.05);
}
.mtb-btn.active {
  background: var(--adim);
  box-shadow: inset 0 0 0 1.5px var(--accent);
}
.mtb-icon {
  font-size: 19px;
  line-height: 1;
}
.mtb-more {
  position: absolute;
  right: 4px;
  bottom: 2px;
  font-size: 7px;
  color: var(--t3);
}
.mtb-sep {
  height: 1px;
  background: var(--border);
  margin: 3px 6px;
}
.mtb-fly {
  position: absolute;
  left: calc(100% + 12px);
  top: -6px;
  padding: 8px;
  min-width: 190px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow);
  z-index: 10;
}
.mtb-fly::before {
  content: '';
  position: absolute;
  left: -14px;
  top: 0;
  width: 14px;
  height: 60px;
}
.mtb-fly-title {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  color: var(--t3);
  padding: 2px 6px 6px;
}
.mtb-fly-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2px;
}
.mtb-fly-grid.wide {
  grid-template-columns: 1fr 1fr;
  min-width: 330px;
}
.mtb-tool {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 9px;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: var(--t1);
  font-family: var(--font);
  font-size: 12.5px;
  cursor: pointer;
  text-align: left;
  animation: mtb-tool-in 0.3s cubic-bezier(0.22, 1, 0.36, 1) backwards;
  animation-delay: calc(var(--i) * 18ms);
  transition: background 0.12s;
}
@keyframes mtb-tool-in {
  from {
    opacity: 0;
    transform: translateX(-6px);
  }
}
.mtb-tool:hover {
  background: var(--hover);
}
.mtb-tool.active {
  background: var(--adim);
  color: var(--accent);
}
.mtb-tool-icon {
  font-size: 16px;
  width: 20px;
  text-align: center;
}
.mtb-tool-name {
  flex: 1;
  white-space: nowrap;
}
.mtb-kbd {
  font-family: var(--font);
  font-size: 10px;
  color: var(--t3);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0 5px;
}
.mtb-fly-enter-active,
.mtb-fly-leave-active {
  transition:
    opacity 0.16s,
    transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}
.mtb-fly-enter-from,
.mtb-fly-leave-to {
  opacity: 0;
  transform: translateX(-8px) scale(0.97);
}
</style>
