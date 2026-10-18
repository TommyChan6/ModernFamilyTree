<template>
  <div class="mf" @pointerdown.stop @wheel.stop>
    <SearchField
      ref="searchRef"
      v-model="query"
      size="sm"
      :placeholder="t('map.find.placeholder')"
      @keydown="onKey"
    />
    <div ref="listEl" class="mf-list" role="listbox">
      <button
        v-for="(it, i) in shown"
        :key="it.type + it.id"
        class="mf-row"
        :class="{ on: i === active, faded: it.faded }"
        role="option"
        :aria-selected="i === active"
        @mouseenter="active = i"
        @click="emit('pick', it)"
      >
        <span v-if="it.type === 'token'" class="mf-avatar" :style="{ background: it.color }">
          <img v-if="it.imgUrl" :src="it.imgUrl" alt="" />
          <span v-else>{{ it.initial }}</span>
        </span>
        <span v-else class="mf-icon" :style="it.color ? { color: it.color } : null">
          <UiIcon :name="it.icon" :size="16" />
        </span>
        <span class="mf-text">
          <span class="mf-name">{{ it.name }}</span>
          <span class="mf-sub">{{ it.sub }}</span>
        </span>
        <UiIcon v-if="i === active" class="mf-go" name="corner-down-left" :size="14" />
      </button>
      <div v-if="!shown.length" class="mf-empty">
        {{ items.length ? t('map.find.none') : t('map.find.empty') }}
      </div>
    </div>
    <div class="mf-foot">{{ t('map.find.foot') }}</div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from '../../i18n'
import UiIcon from '../ui/UiIcon.js'
import SearchField from '../ui/SearchField.vue'
import { matchScore } from './mapMath'

// Find on the map: every named place, realm, route, event and every person
// standing on the map, ranked by how well the name matches. Enter / click
// flies there (MapView does the flying). Items arrive ready-made:
// { id, type: 'feature' | 'token', name, sub, icon, color?, imgUrl?, initial?, faded?, rank? }
const props = defineProps({
  items: { type: Array, required: true }
})
const emit = defineEmits(['pick', 'close'])
const { t } = useI18n()

const query = ref('')
const active = ref(0)
const searchRef = ref(null)
const listEl = ref(null)

const shown = computed(() => {
  const q = query.value
  const scored = []
  for (const it of props.items) {
    const s = matchScore(it.name, q)
    if (s >= 0) scored.push({ it, s })
  }
  // equally good matches: capitals before villages, then A–Z
  scored.sort(
    (a, b) => a.s - b.s || (a.it.rank || 0) - (b.it.rank || 0) || a.it.name.localeCompare(b.it.name)
  )
  return scored.slice(0, 60).map((e) => e.it)
})
watch(query, () => (active.value = 0))

function onKey(e) {
  const n = shown.value.length
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    if (!n) return
    active.value = (active.value + (e.key === 'ArrowDown' ? 1 : n - 1)) % n
    nextTick(() => listEl.value?.children[active.value]?.scrollIntoView?.({ block: 'nearest' }))
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const it = shown.value[active.value]
    if (it) emit('pick', it)
  } else if (e.key === 'Escape' && !query.value) {
    e.preventDefault()
    emit('close')
  }
}

onMounted(() => searchRef.value?.focus())
</script>

<style scoped>
.mf {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 320px;
}
.mf-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  max-height: min(52vh, 420px);
  overflow-y: auto;
}
.mf-row {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 5px 8px;
  border: none;
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--t1);
  font-family: var(--font);
  text-align: left;
  cursor: pointer;
}
.mf-row.on {
  background: var(--hover);
}
.mf-row.faded .mf-name {
  color: var(--t2);
}
.mf-icon,
.mf-avatar {
  flex: 0 0 auto;
  width: var(--ctl-sm);
  height: var(--ctl-sm);
  display: grid;
  place-items: center;
  border-radius: var(--r-sm);
  background: var(--elevated);
  color: var(--t1);
}
.mf-avatar {
  border-radius: 50%;
  overflow: hidden;
  color: #fff;
  font-weight: 800;
  font-size: var(--fs-sm);
}
.mf-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.mf-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.mf-name {
  font-size: var(--fs-md);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mf-sub {
  font-size: var(--fs-xs);
  color: var(--t3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mf-go {
  flex: 0 0 auto;
  color: var(--t3);
}
.mf-empty {
  padding: 14px 8px;
  font-size: var(--fs-sm);
  color: var(--t3);
  text-align: center;
  line-height: 1.45;
}
.mf-foot {
  font-size: var(--fs-xs);
  color: var(--t3);
  padding: 2px 4px 0;
  border-top: 1px solid var(--border);
  padding-top: 6px;
}
</style>
