<template>
  <!-- Profile section: the person's whole family, named — grouped the way a
       family actually talks about itself — beside their ancestor fan and the
       pedigree numbers (how complete, how collapsed, how inbred). -->
  <div class="ks">
    <div class="ks-groups">
      <div v-for="(g, gi) in groups" :key="g.key" class="ks-group" :style="{ '--gi': gi }">
        <div class="ks-g-head">
          <UiIcon class="ks-g-ic" :name="g.icon" :size="14" />{{
            t(`kinship.section.groups.${g.key}`)
          }}
          <span class="ks-g-n">{{ g.items.length }}</span>
        </div>
        <div class="ks-chips">
          <button
            v-for="(c, i) in expanded[g.key] ? g.items : g.items.slice(0, CAP)"
            :key="c.id"
            class="ks-chip"
            :style="{ '--kc': c.color, '--pc': c.pcolor, '--i': i }"
            :title="`${c.name} — ${c.rel}`"
            @click="$emit('navigate', c.id)"
          >
            <span class="ks-av">{{ c.initials }}</span>
            <span class="ks-text">
              <span class="ks-rel">{{ c.rel }}</span>
              <span class="ks-name">{{ c.name }}</span>
            </span>
          </button>
          <button
            v-if="g.items.length > CAP"
            class="ks-more"
            @click="expanded[g.key] = !expanded[g.key]"
          >
            {{ expanded[g.key] ? t('kinship.section.less') : `+${g.items.length - CAP}` }}
          </button>
        </div>
      </div>
      <div v-if="!groups.length" class="ks-empty">{{ t('kinship.section.empty') }}</div>
    </div>

    <aside class="ks-side">
      <FanChart
        :rings="fan"
        :name-of="personName"
        :color-of="personColor"
        :hub-name="personName(personId)"
        @pick="(id) => $emit('navigate', id)"
      />
      <div class="ks-stats">
        <div class="ks-stat">
          <span class="ks-stat-v">{{ completeness }}%</span>
          <span class="ks-stat-k">{{ t('kinship.section.pedigreeKnown') }}</span>
          <span class="ks-bar"><span :style="{ width: completeness + '%' }"></span></span>
        </div>
        <div class="ks-stat">
          <span class="ks-stat-v">{{ ped.deepest || 0 }}</span>
          <span class="ks-stat-k">{{ t('kinship.section.generationsBack') }}</span>
        </div>
        <div class="ks-stat" :class="{ 'ks-warn': ped.collapse > 0 }">
          <span class="ks-stat-v">{{ Math.round(ped.collapse * 100) }}%</span>
          <span class="ks-stat-k" :title="t('kinship.section.collapseTitle')">
            {{ t('kinship.section.collapse') }}
          </span>
        </div>
      </div>
      <div v-if="F > 0" class="ks-inbred">
        <div class="ks-stat-k">{{ t('kinship.section.inbreeding') }}</div>
        <BloodMeter :phi="F" />
      </div>
    </aside>
  </div>
</template>

<script setup>
import { computed, reactive } from 'vue'
import { useKinship, kinClass, kinPalette } from './useKinship'
import { ancestorFan, pedigreeStats } from './kinshipGraph'
import FanChart from './FanChart.vue'
import BloodMeter from './BloodMeter.vue'
import UiIcon from '../ui/UiIcon.js'
import { useI18n } from '../../i18n'

const props = defineProps({ personId: { type: String, required: true } })
defineEmits(['navigate'])

const K = useKinship()
const { personName, personColor, kinLang } = K
const { t } = useI18n()
const CAP = 10
const expanded = reactive({})

const GROUPS = [
  // labels: kinship.section.groups.<key>
  { key: 'ancestors', icon: 'tree-deciduous' },
  { key: 'siblings', icon: 'users' },
  { key: 'descendants', icon: 'sprout' },
  { key: 'collateral', icon: 'leaf' },
  { key: 'cousins', icon: 'git-branch' },
  { key: 'marriage', icon: 'heart-handshake' },
  { key: 'step', icon: 'link-2' }
]

function groupOf(k) {
  switch (k.kind) {
    case 'blood':
      if (k.down === 0) return 'ancestors'
      if (k.up === 0) return 'descendants'
      if (k.up === 1 && k.down === 1) return 'siblings'
      if (k.up === 1 || k.down === 1) return 'collateral'
      return 'cousins'
    case 'spouse':
    case 'inlaw':
    case 'affine':
    case 'coparent':
      return 'marriage'
    case 'step':
      return 'step'
    default:
      return null
  }
}

const groups = computed(() => {
  void kinLang.value
  const lens = K.lensOf(props.personId)
  const pal = kinPalette()
  const buckets = new Map()
  for (const [id, k] of lens) {
    if (id === props.personId) continue
    const g = groupOf(k)
    if (!g) continue
    const name = personName(id)
    const parts = name.trim().split(/\s+/)
    const item = {
      id,
      name,
      initials: (
        (parts[0]?.[0] || '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')
      ).toUpperCase(),
      rel: K.nameOf(k, props.personId, id),
      color: pal[kinClass(k)] || pal.distant,
      pcolor: personColor(id),
      order: (k.kind === 'spouse' ? -1 : k.up + k.down) * 100 + k.up
    }
    if (!buckets.has(g)) buckets.set(g, [])
    buckets.get(g).push(item)
  }
  return GROUPS.filter((g) => buckets.has(g.key)).map((g) => ({
    ...g,
    items: buckets.get(g.key).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
  }))
})

const fan = computed(() => ancestorFan(K.index.value, props.personId, 5))
const ped = computed(() => pedigreeStats(K.index.value, props.personId, 5))
const completeness = computed(() => {
  const slots = ped.value.gens.reduce((a, g) => a + g.slots, 0)
  return slots ? Math.round((ped.value.known / slots) * 100) : 0
})
const F = computed(() => K.coef.value.F(props.personId))
</script>

<style scoped>
.ks {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 220px;
  gap: 18px;
  align-items: start;
}
@media (max-width: 900px) {
  .ks {
    grid-template-columns: 1fr;
  }
}
.ks-groups {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.ks-group {
  animation: cp-row-in 0.5s var(--ease-out) backwards;
  animation-delay: calc(0.15s + var(--gi) * 0.07s);
}
.ks-g-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--t3);
  margin-bottom: 6px;
}
.ks-g-ic {
  flex-shrink: 0;
}
.ks-g-n {
  font-size: 11px;
  font-weight: 700;
  color: var(--t2);
  background: var(--elevated);
  border-radius: var(--r-pill);
  padding: 0 7px;
}
.ks-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.ks-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 4px 11px 4px 4px;
  border-radius: var(--r-pill);
  border: 1px solid color-mix(in srgb, var(--kc) 32%, var(--border));
  background: color-mix(in srgb, var(--kc) 8%, var(--glass-strong));
  color: var(--t1);
  font-family: var(--font);
  cursor: pointer;
  max-width: 100%;
  animation: ks-pop 0.42s var(--ease-spring) backwards;
  animation-delay: calc(0.25s + var(--i) * 0.03s);
  transition:
    transform 0.2s var(--ease-spring),
    box-shadow 0.2s ease,
    border-color 0.2s ease;
}
.ks-chip:hover {
  transform: translateY(-2px);
  border-color: var(--kc);
  box-shadow: 0 6px 18px color-mix(in srgb, var(--kc) 30%, transparent);
}
@keyframes ks-pop {
  from {
    opacity: 0;
    transform: scale(0.8) translateY(6px);
  }
}
.ks-av {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--pc);
  color: #fff;
  font-size: 10.5px;
  font-weight: 800;
  flex-shrink: 0;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--kc) 70%, transparent);
}
.ks-text {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
  min-width: 0;
  text-align: left;
}
.ks-rel {
  font-size: 11px;
  font-weight: 800;
  color: var(--kc);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ks-name {
  font-size: 12.5px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ks-more {
  border: 1px dashed var(--border-strong);
  background: transparent;
  color: var(--t2);
  border-radius: var(--r-pill);
  padding: 4px 11px;
  font-family: var(--font);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.ks-empty {
  color: var(--t3);
  font-size: 12.5px;
}
.ks-side {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border-radius: var(--r-lg);
  background: var(--glass-strong);
  border: 1px solid var(--border);
}
.ks-stats {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 6px;
}
.ks-stat {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.ks-stat-v {
  font-size: 16px;
  font-weight: 800;
  color: var(--t1);
  font-variant-numeric: tabular-nums;
}
.ks-warn .ks-stat-v {
  color: var(--kin-blood);
}
.ks-stat-k {
  font-size: var(--fs-xs);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--t3);
  line-height: 1.2;
}
.ks-bar {
  height: 3px;
  border-radius: 2px;
  background: var(--elevated);
  overflow: hidden;
  margin-top: 3px;
}
.ks-bar span {
  display: block;
  height: 100%;
  background: var(--accent);
  animation: ks-grow 1s var(--ease-out) 0.4s backwards;
  transform-origin: left;
}
@keyframes ks-grow {
  from {
    transform: scaleX(0);
  }
}
.ks-inbred {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* ── 水墨 ink theme ─────────────────────────────────────────────────────── */
:root[data-theme='ink'] .ks-chip {
  border-radius: 3px 5px 4px 6px / 5px 3px 6px 4px;
}
:root[data-theme='ink'] .ks-av {
  border-radius: 3px 5px 2px 6px / 5px 2px 6px 3px;
}
:root[data-theme='ink'] .ks-rel {
  font-family: var(--font-brush);
  font-size: 14px;
  font-weight: 400;
}
:root[data-theme='ink'] .ks-g-head {
  font-family: var(--font-ink-label);
  font-variant: small-caps;
  text-transform: lowercase;
  letter-spacing: 0.12em;
}
:root[data-theme='ink'] .ks-stat-v {
  font-family: var(--font-brush);
  font-weight: 400;
}
:root[data-theme='ink'] .ks-bar {
  border-radius: 1px;
}
</style>
