<template>
  <div class="st-sheet">
    <!-- The Directory's own style: the card faces (the toolbar chip opens the
         same gallery). -->
    <section class="st-section" data-skey="cardStyle">
      <h4 class="st-sec-title">{{ t('directory.cardStyle.title') }}</h4>
      <p class="st-note">{{ t('directory.cardStyle.sub') }}</p>
      <CardStylePicker inline />
      <p class="st-note dst-blurb">
        <b>{{ t(`directory.cardStyle.styles.${store.cardStyle}.label`) }}</b>
        — {{ t(`directory.cardStyle.styles.${store.cardStyle}.blurb`) }}
      </p>
    </section>
    <p v-if="!cardMode" class="st-callout">
      <span><UiIcon name="info" :size="14" />{{ t('styleStudio.directory.cardModesOnly') }}</span>
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useMainStore } from '../../store/index.js'
import { useI18n } from '../../i18n'
import CardStylePicker from '../people/CardStylePicker.vue'
import UiIcon from '../ui/UiIcon.js'

defineProps({ chapter: { type: String, default: 'cards' } })

const store = useMainStore()
const { t } = useI18n()
// Card faces show in the grid and the card-stage modes only.
const CARD_MODES = ['grid', 'wheel', 'flow', 'fan', 'deck']
const cardMode = computed(() => CARD_MODES.includes(store.viewMode))
</script>

<style scoped>
.dst-blurb {
  min-height: 2.8em;
}
.dst-blurb b {
  color: var(--t1);
}
</style>
