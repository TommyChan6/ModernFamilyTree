<template>
  <aside
    v-if="ad"
    class="ad"
    :class="'ad-' + placement"
    :style="{ '--h': ad.hue }"
    :aria-label="t('ads.label')"
  >
    <div class="ad-art" aria-hidden="true">
      <span class="ad-orb"></span>
      <span class="ad-emoji">{{ ad.emoji }}</span>
    </div>
    <div class="ad-copy">
      <p class="ad-meta">
        <span class="ad-chip">{{ t('ads.label') }}</span>
        <span>{{ ad.sponsor === 'house' ? t('ads.houseSponsor') : ad.sponsor }}</span>
      </p>
      <h4 class="ad-title">{{ copy.title }}</h4>
      <p v-if="placement !== 'strip'" class="ad-body">{{ copy.body }}</p>
      <div class="ad-actions">
        <button class="ad-cta" @click="click">{{ copy.cta }} →</button>
        <button class="ad-remove" @click="removeAds">{{ t('ads.remove') }}</button>
      </div>
    </div>
    <button class="ad-x" :title="t('ads.dismiss')" :aria-label="t('ads.dismiss')" @click="dismiss">
      ✕
    </button>
  </aside>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useMainStore } from '../../store/index.js'
import { useI18n } from '../../i18n'
import { dismissAd, getAdProvider } from '../../lib/ads'

const props = defineProps({
  placement: { type: String, default: 'banner' }, // 'card' | 'banner' | 'strip'
  seed: { type: Number, default: 0 },
  /** Action kinds pointless on this surface (e.g. ['browse'] on Browse). */
  exclude: { type: Array, default: () => [] }
})

const store = useMainStore()
const { t } = useI18n()
const dismissed = ref(false)

// Paid plans never see ads; guests and free accounts do.
const ad = computed(() => {
  if (store.adFree || dismissed.value) return null
  return getAdProvider().pick({
    placement: props.placement,
    seed: props.seed,
    exclude: props.exclude
  })
})
const copy = computed(() => {
  const a = ad.value
  if (!a) return { title: '', body: '', cta: '' }
  if (a.text) return a.text
  return {
    title: t(a.copyKey + '.title'),
    body: t(a.copyKey + '.body'),
    cta: t(a.copyKey + '.cta')
  }
})

onMounted(() => {
  if (ad.value) getAdProvider().track('impression', ad.value, props.placement)
})

function click() {
  const a = ad.value
  if (!a) return
  getAdProvider().track('click', a, props.placement)
  if (a.action.kind === 'pricing') store.openPricing({ reason: 'ads', plan: a.action.plan })
  else if (a.action.kind === 'browse') {
    store.toggleProjectsPage(false)
    store.toggleBrowsePage(true)
  } else if (a.action.kind === 'url') window.open(a.action.href, '_blank', 'noopener')
}
function removeAds() {
  store.openPricing({ reason: 'ads', plan: 'plus' })
}
function dismiss() {
  const a = ad.value
  if (!a) return
  getAdProvider().track('dismiss', a, props.placement)
  dismissAd(a.id)
  dismissed.value = true
}
</script>

<style scoped>
.ad {
  position: relative;
  display: flex;
  gap: 14px;
  align-items: center;
  border-radius: var(--r-lg);
  border: 1px dashed rgba(var(--accent-rgb), 0.35);
  background:
    radial-gradient(120% 140% at 0% 0%, hsl(var(--h) 70% 55% / 0.12), transparent 60%),
    var(--surface);
  color: var(--t1);
  overflow: hidden;
}
.ad-art {
  position: relative;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: var(--r-md);
  overflow: hidden;
  background: linear-gradient(140deg, hsl(var(--h) 55% 18%), hsl(calc(var(--h) + 40) 55% 12%));
}
.ad-orb {
  position: absolute;
  width: 140%;
  height: 140%;
  background: radial-gradient(circle at 30% 30%, hsl(var(--h) 80% 65% / 0.55), transparent 55%);
  animation: ad-orbit 9s linear infinite;
}
@keyframes ad-orbit {
  to {
    transform: rotate(360deg);
  }
}
.ad-emoji {
  position: relative;
  color: #fff; /* text glyphs (✦) on the always-dark art tile */
  font-size: 30px;
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.45));
}
.ad-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}
.ad-meta {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10.5px;
  color: var(--t3);
}
.ad-chip {
  padding: 1px 6px;
  border-radius: var(--r-xs);
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--t2);
  background: var(--elevated);
}
.ad-title {
  margin: 0;
  font-size: 14px;
  font-weight: 800;
}
.ad-body {
  margin: 0;
  font-size: 12.5px;
  color: var(--t2);
  line-height: 1.5;
}
.ad-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 4px;
  flex-wrap: wrap;
}
.ad-cta {
  padding: 6px 12px;
  border-radius: var(--r-pill);
  border: none;
  font-weight: 800;
  font-size: 12px;
  cursor: pointer;
  color: var(--on-accent);
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  transition: transform 0.2s var(--ease-spring);
}
.ad-cta:hover {
  transform: translateY(-1px);
}
.ad-remove {
  border: none;
  background: none;
  padding: 0;
  font-size: 11.5px;
  color: var(--t2);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.ad-remove:hover {
  color: var(--accent);
}
.ad-x {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: none;
  background: var(--elevated);
  color: var(--t3);
  font-size: 10px;
  cursor: pointer;
}
.ad-x:hover {
  color: var(--t1);
}

/* Card: same footprint as a BrowseCard, so it sits in the grid naturally. */
.ad-card {
  flex-direction: column;
  align-items: stretch;
  gap: 0;
  min-height: 280px;
}
.ad-card .ad-art {
  height: 150px;
  border-radius: 0;
}
.ad-card .ad-emoji {
  font-size: 52px;
}
.ad-card .ad-copy {
  padding: 12px 14px 14px;
}
.ad-card .ad-x {
  background: rgba(10, 12, 22, 0.5);
  color: #fff;
}

.ad-banner {
  padding: 14px 44px 14px 14px;
}
.ad-banner .ad-art {
  width: 86px;
  height: 86px;
}

.ad-strip {
  padding: 8px 40px 8px 8px;
  gap: 10px;
}
.ad-strip .ad-art {
  width: 44px;
  height: 44px;
}
.ad-strip .ad-emoji {
  font-size: 20px;
}
.ad-strip .ad-copy {
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 12px;
}
.ad-strip .ad-title {
  font-size: 13px;
}
.ad-strip .ad-actions {
  margin: 0 0 0 auto;
}

@media (max-width: 640px) {
  .ad-banner {
    flex-direction: column;
    align-items: flex-start;
  }
}
@media (prefers-reduced-motion: reduce) {
  .ad-orb {
    animation: none;
  }
}
</style>
