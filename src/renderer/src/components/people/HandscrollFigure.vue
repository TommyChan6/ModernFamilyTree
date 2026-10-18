<template>
  <!-- One person on the handscroll: a portrait roundel (photo washed into the
       paper, or a brushed initial in an ensō), the name in a vertical
       calligraphy column with the dates beside it, and their name seal. -->
  <button
    class="hf"
    :class="{ child: role === 'child', sel: selected, dead: deceased }"
    :title="person.name || t('directory.card.unnamed')"
    @click="$emit('open', person.id)"
  >
    <span class="hf-bloom" :style="{ backgroundImage: `url(${bloom})` }"></span>
    <span class="hf-roundel">
      <img
        v-if="src"
        class="hf-photo"
        :src="src"
        alt=""
        draggable="false"
        decoding="async"
        :style="{ maskImage: `url(${mask})`, webkitMaskImage: `url(${mask})` }"
      />
      <template v-else>
        <img class="hf-enso" :src="enso" alt="" draggable="false" />
        <span class="hf-glyph" :class="{ latin: !cjkGlyph }">{{ glyph }}</span>
      </template>
      <i v-if="selected" class="hf-ring"></i>
    </span>
    <span class="hf-cols">
      <span class="hf-name" :class="{ cjk: cjkName, unnamed: !person.name }">{{
        person.name || t('directory.card.unnamed')
      }}</span>
      <span v-if="span" class="hf-dates">{{ span }}</span>
    </span>
    <img v-if="seal" class="hf-seal" :src="seal" alt="" draggable="false" />
  </button>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from '../../i18n'
import { hashStr } from '../../lib/inkArt'
import { useThumbnail } from './useThumbnail.js'
import { washMaskUrl, bloomUrl, ensoUrl, useInkSeal, isCjkName } from './inkPeopleArt'
import { roundelGlyph, lifeSpan } from './handscrollLayout'

const props = defineProps({
  person: { type: Object, required: true },
  role: { type: String, default: 'head' },
  selected: { type: Boolean, default: false },
  deceased: { type: Boolean, default: false }
})
defineEmits(['open'])

const { t } = useI18n()

const seed = computed(() => hashStr(props.person.id || ''))
const { src } = useThumbnail(() => props.person.primary_image || '', 192)
const mask = computed(() => washMaskUrl(seed.value % 4))
const bloom = computed(() => bloomUrl(seed.value % 3))
const enso = computed(() => ensoUrl(seed.value))
const glyph = computed(() => roundelGlyph(props.person.name))
const cjkGlyph = computed(() => /[㐀-鿿]/.test(glyph.value))
const cjkName = computed(() => isCjkName(props.person.name))
const span = computed(() =>
  lifeSpan(props.person, {
    born: (year) => t('directory.card.born', { year }),
    died: (year) => t('directory.card.died', { year })
  })
)
const seal = useInkSeal(
  () => props.person.name || '',
  () => props.person.id || '',
  64
)
</script>

<style scoped>
.hf {
  position: absolute;
  width: 112px;
  margin-left: -56px;
  padding: 0;
  border: none;
  background: transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  transform-origin: 50% 0;
  transform: scale(var(--s, 1));
  color: var(--ink-black);
  animation: hf-in 0.8s cubic-bezier(0.22, 1, 0.36, 1) backwards;
}
@keyframes hf-in {
  from {
    opacity: 0;
    filter: blur(3px);
  }
}
.hf:focus-visible {
  outline: none;
}
.hf:focus-visible .hf-roundel {
  box-shadow: 0 0 0 2px rgba(var(--ink-cinnabar-rgb), 0.6);
}
/* 晕染 — an ink bloom that spreads behind the figure on hover */
.hf-bloom {
  position: absolute;
  left: 50%;
  top: -26px;
  width: 150px;
  height: 150px;
  margin-left: -75px;
  background-size: cover;
  opacity: 0;
  transform: scale(0.55);
  mix-blend-mode: multiply;
  pointer-events: none;
  transition:
    opacity 1s ease,
    transform 1.5s cubic-bezier(0.22, 1, 0.36, 1);
}
.hf:hover .hf-bloom,
.hf.sel .hf-bloom {
  opacity: 0.3;
  transform: scale(1.05);
}
.hf-roundel {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.8s cubic-bezier(0.22, 1, 0.36, 1);
}
.hf:hover .hf-roundel {
  transform: translateY(-3px);
}
.hf-photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
  filter: grayscale(1) sepia(0.3) contrast(1.2) brightness(1.05);
  mix-blend-mode: multiply;
}
.hf.dead .hf-photo {
  filter: grayscale(1) sepia(0.45) contrast(1.05) brightness(1.1);
}
.hf-enso {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  mix-blend-mode: multiply;
  opacity: 0.85;
}
.hf-glyph {
  position: relative;
  font-family: var(--font-xing);
  font-size: 36px;
  line-height: 1;
  opacity: 0.88;
}
.hf-glyph.latin {
  font-family: var(--font-brush);
  font-size: 25px;
}
/* selected: a cinnabar circle brushed around the roundel */
.hf-ring {
  position: absolute;
  inset: -7px;
  border-radius: 50%;
  border: 2px solid rgba(var(--ink-cinnabar-rgb), 0.85);
  border-left-color: rgba(var(--ink-cinnabar-rgb), 0.35);
  transform: rotate(-20deg);
  animation: hf-ring 0.7s cubic-bezier(0.22, 1, 0.36, 1) backwards;
}
@keyframes hf-ring {
  from {
    opacity: 0;
    transform: rotate(-120deg) scale(0.85);
  }
}
.hf-cols {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 8px;
  writing-mode: vertical-rl;
  max-height: 150px;
}
.hf-name {
  font-family: var(--font-brush);
  font-size: 18px;
  line-height: 1.12;
  letter-spacing: 0.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-height: 150px;
  /* mist around the inscription keeps it legible over the painted hills */
  text-shadow:
    0 0 6px rgba(239, 230, 208, 0.95),
    0 0 2px rgba(239, 230, 208, 0.9);
  transition: color 0.4s ease;
}
.hf-name.cjk {
  font-size: 22px;
  letter-spacing: 4px;
}
.hf-name.unnamed {
  opacity: 0.5;
}
.hf-dates {
  font-family: var(--font-ink-serif);
  font-size: 11.5px;
  color: #5d5246;
  white-space: nowrap;
  padding-top: 6px;
  text-shadow: 0 0 5px rgba(239, 230, 208, 0.95);
}
.hf-seal {
  width: 20px;
  height: 20px;
  margin-top: 5px;
  opacity: 0.92;
  mix-blend-mode: multiply;
  transform: rotate(-3deg);
  transition: transform 0.45s cubic-bezier(0.34, 1.4, 0.5, 1);
}
.hf:hover .hf-seal,
.hf.sel .hf-seal {
  transform: rotate(-3deg) scale(1.18);
}
.hf.child .hf-roundel {
  width: 68px;
  height: 68px;
}

@media (prefers-reduced-motion: reduce) {
  .hf,
  .hf-ring {
    animation: none;
  }
  .hf-bloom,
  .hf-roundel {
    transition: none;
  }
}
</style>
