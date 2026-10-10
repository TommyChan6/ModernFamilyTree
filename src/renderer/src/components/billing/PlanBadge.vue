<template>
  <span class="pb" :class="['pb-' + tier, { big }]">
    <UiIcon v-if="GLYPH[tier]" class="pb-glyph" :name="GLYPH[tier]" :size="big ? 14 : 12" />
    {{ t('billing.plans.' + tier + '.name') }}
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from '../../i18n'
import UiIcon from '../ui/UiIcon.js'

const props = defineProps({
  plan: { type: String, default: 'free' },
  big: { type: Boolean, default: false }
})
const { t } = useI18n()
const GLYPH = { plus: 'sparkles', pro: 'gem', guest: 'hand' }
const tier = computed(() => (['plus', 'pro', 'guest'].includes(props.plan) ? props.plan : 'free'))
</script>

<style scoped>
.pb {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: var(--r-pill);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.02em;
  white-space: nowrap;
  color: var(--t2);
  background: var(--elevated);
  border: 1px solid var(--border);
}
.pb.big {
  padding: 4px 12px;
  font-size: 13px;
}
.pb-plus {
  color: var(--on-accent);
  border-color: transparent;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  box-shadow: var(--glow);
}
.pb-pro {
  color: #1a1d2e;
  border-color: transparent;
  background: linear-gradient(135deg, #ffe27a, #ffb36b 55%, #ff8fb1);
  box-shadow: 0 0 14px rgba(255, 196, 110, 0.4);
  background-size: 200% 200%;
  animation: pb-shine 4s ease-in-out infinite;
}
@keyframes pb-shine {
  50% {
    background-position: 100% 50%;
  }
}
.pb-glyph {
  flex-shrink: 0;
}
@media (prefers-reduced-motion: reduce) {
  .pb-pro {
    animation: none;
  }
}
</style>
