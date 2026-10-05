<template>
  <!-- 团扇 — a round silk "moon fan" on a bamboo handle. The leaf carries one
       of the classic fan subjects (plum, bamboo, orchid, moon over hills),
       the person's portrait washed into the silk when there is a photo, the
       name brushed in the empty space opposite the motif, and their seal. -->
  <div class="fn" :class="{ dead: deceased }" :style="styleVars">
    <div class="fn-fan">
      <div class="fn-leaf">
        <img class="fn-motif" :src="motif" alt="" draggable="false" />
        <div class="fn-bloom" :style="{ backgroundImage: `url(${bloom})` }"></div>
        <div v-if="avatarSrc" class="fn-portrait">
          <img
            :src="avatarSrc"
            alt=""
            draggable="false"
            decoding="async"
            :style="{ maskImage: `url(${mask})`, webkitMaskImage: `url(${mask})` }"
          />
        </div>
        <div class="fn-cols">
          <span class="fn-name" :class="{ cjk: cjkName, unnamed: !person.name }">{{
            person.name || 'Unnamed'
          }}</span>
          <span v-if="lifeText || person.occupation" class="fn-meta"
            >{{ lifeText }}<template v-if="lifeText && person.occupation"> · </template
            >{{ person.occupation }}</span
          >
        </div>
        <img v-if="seal" class="fn-seal" :src="seal" alt="" draggable="false" />
        <i class="fn-sheen"></i>
      </div>
      <i class="fn-cap"></i>
      <i class="fn-handle"></i>
      <span class="fn-tassel">
        <i class="fn-knot"></i>
        <i class="fn-fringe"></i>
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { hashStr } from '../../lib/inkArt'
import {
  paintingPaperUrl,
  washMaskUrl,
  bloomUrl,
  fanMotifUrl,
  useInkSeal,
  isCjkName
} from './inkPeopleArt'

const props = defineProps({
  person: { type: Object, required: true },
  avatarSrc: { type: String, default: '' },
  deceased: { type: Boolean, default: false },
  lifeText: { type: String, default: '' }
})

const seed = computed(() => hashStr(props.person.id || props.person.name || ''))
const motif = computed(() => fanMotifUrl(seed.value))
const mask = computed(() => washMaskUrl(seed.value % 4))
const bloom = computed(() => bloomUrl(seed.value % 3))
const cjkName = computed(() => isCjkName(props.person.name))
const seal = useInkSeal(
  () => props.person.name || '',
  () => props.person.id || '',
  64
)
const styleVars = computed(() => ({ '--fn-paper': `url(${paintingPaperUrl()})` }))
</script>

<style scoped>
.fn {
  position: absolute;
  inset: 0;
  pointer-events: none;
  perspective: 700px;
}
.fn-fan {
  position: absolute;
  inset: 0;
  transform-origin: 50% 64%;
  transform-style: preserve-3d;
}

/* ── the silk leaf ── */
.fn-leaf {
  position: absolute;
  left: 15px;
  top: 10px;
  width: 180px;
  height: 180px;
  border-radius: 50%;
  overflow: hidden;
  isolation: isolate;
  background:
    repeating-linear-gradient(0deg, rgba(120, 95, 55, 0.05) 0 1px, transparent 1px 3px),
    repeating-linear-gradient(90deg, rgba(120, 95, 55, 0.04) 0 1px, transparent 1px 3px),
    var(--fn-paper) 0 0 / 256px 256px,
    #f3ead6;
  /* lacquered bamboo rim */
  box-shadow:
    0 0 0 4px #6a4a2f,
    0 0 0 5px #2c1e12,
    0 0 0 6px rgba(255, 235, 200, 0.18),
    0 12px 22px -8px rgba(0, 0, 0, 0.5),
    inset 0 0 22px rgba(120, 88, 40, 0.22);
  transition: box-shadow 0.4s ease;
}
.fn.dead .fn-leaf {
  filter: sepia(0.2) saturate(0.85);
}
.fn-motif {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  mix-blend-mode: multiply;
  opacity: 0.92;
}
.fn-bloom {
  position: absolute;
  left: 8px;
  top: 30px;
  width: 110px;
  height: 110px;
  background-size: cover;
  mix-blend-mode: multiply;
  opacity: 0;
  transform: scale(0.6);
  transition:
    opacity 0.9s ease,
    transform 1.4s cubic-bezier(0.22, 1, 0.36, 1);
}
.fn-portrait {
  position: absolute;
  left: 58px;
  top: 82px;
  width: 78px;
  height: 78px;
}
.fn-portrait img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
  filter: grayscale(1) sepia(0.3) contrast(1.2) brightness(1.06);
  mix-blend-mode: multiply;
}
.fn-cols {
  position: absolute;
  left: 30px;
  top: 34px;
  height: 108px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  writing-mode: vertical-rl;
}
.fn-name {
  font-family: var(--font-brush);
  font-size: 17px;
  line-height: 1.15;
  color: var(--ink-black);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-height: 100%;
}
.fn-name.cjk {
  font-size: 22px;
  letter-spacing: 3px;
}
.fn-name.unnamed {
  opacity: 0.5;
}
.fn-meta {
  font-family: var(--font-ink-serif);
  font-size: 9.5px;
  color: #5d5246;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-height: 100%;
  padding-top: 4px;
}
.fn-seal {
  position: absolute;
  left: 38px;
  top: 146px;
  width: 17px;
  height: 17px;
  mix-blend-mode: multiply;
  opacity: 0.9;
  transition: transform 0.4s cubic-bezier(0.34, 1.4, 0.5, 1);
}
/* silk catches the light as the fan turns */
.fn-sheen {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    115deg,
    transparent 30%,
    rgba(255, 252, 240, 0.32) 46%,
    transparent 60%
  );
  transform: translateX(-70%);
  opacity: 0;
  pointer-events: none;
}

/* ── frame below the leaf ── */
.fn-cap {
  position: absolute;
  left: 50%;
  top: 186px;
  width: 16px;
  height: 12px;
  margin-left: -8px;
  border-radius: 3px 3px 5px 5px;
  background: linear-gradient(90deg, #6f7d6c, #d8e0cf 45%, #9aa995 70%, #5f6d5c);
  box-shadow: 0 2px 3px rgba(0, 0, 0, 0.3);
  z-index: 1;
}
/* 柄 bamboo handle with its nodes */
.fn-handle {
  position: absolute;
  left: 50%;
  top: 194px;
  width: 8px;
  height: 74px;
  margin-left: -4px;
  border-radius: 2px 2px 4px 4px;
  background:
    repeating-linear-gradient(
      180deg,
      transparent 0 21px,
      rgba(40, 28, 15, 0.55) 21px 23px,
      transparent 23px 25px
    ),
    linear-gradient(90deg, #6b5232, #c9a96e 40%, #a3854f 65%, #5d4528);
  box-shadow: 0 4px 6px -2px rgba(0, 0, 0, 0.4);
}
/* 流苏 tassel */
.fn-tassel {
  position: absolute;
  left: 50%;
  top: 266px;
  width: 14px;
  height: 30px;
  margin-left: -7px;
  transform-origin: 50% 0;
}
.fn-knot {
  position: absolute;
  left: 3px;
  top: 0;
  width: 8px;
  height: 8px;
  background: var(--ink-cinnabar);
  transform: rotate(45deg);
  border-radius: 1px;
  box-shadow: inset 0 0 0 1.5px rgba(255, 220, 190, 0.25);
}
.fn-fringe {
  position: absolute;
  left: 2px;
  top: 8px;
  width: 10px;
  height: 22px;
  background: repeating-linear-gradient(
    90deg,
    var(--ink-cinnabar) 0 1px,
    color-mix(in srgb, var(--ink-cinnabar) 70%, #000) 1px 2px
  );
  -webkit-mask: linear-gradient(180deg, #000 60%, transparent);
  mask: linear-gradient(180deg, #000 60%, transparent);
  border-radius: 0 0 4px 4px;
}

/* ── hover: the fan is fanned once, the tassel swings, ink blooms ── */
.pcard:hover .fn-fan {
  animation: fn-flutter 2.4s cubic-bezier(0.37, 0, 0.3, 1) both;
}
@keyframes fn-flutter {
  0% {
    transform: none;
  }
  20% {
    transform: rotateY(16deg) rotateZ(-2deg);
  }
  45% {
    transform: rotateY(-11deg) rotateZ(1.2deg);
  }
  68% {
    transform: rotateY(5deg);
  }
  100% {
    transform: none;
  }
}
.pcard:hover .fn-tassel {
  animation: fn-swing 2.6s cubic-bezier(0.37, 0, 0.3, 1) both;
}
@keyframes fn-swing {
  0% {
    transform: none;
  }
  22% {
    transform: rotate(-14deg);
  }
  46% {
    transform: rotate(10deg);
  }
  70% {
    transform: rotate(-5deg);
  }
  100% {
    transform: none;
  }
}
.pcard:hover .fn-sheen {
  animation: fn-sheen 1.6s ease-out 0.15s both;
}
@keyframes fn-sheen {
  0% {
    opacity: 0;
    transform: translateX(-70%);
  }
  30% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateX(70%);
  }
}
.pcard:hover .fn-bloom {
  opacity: 0.3;
  transform: scale(1.1);
}
.pcard:hover .fn-seal {
  transform: scale(1.15) rotate(-3deg);
}
.pcard.selected .fn-leaf {
  box-shadow:
    0 0 0 4px #6a4a2f,
    0 0 0 6px var(--accent),
    0 0 24px -2px rgba(var(--accent-rgb), 0.55),
    0 12px 22px -8px rgba(0, 0, 0, 0.5),
    inset 0 0 22px rgba(120, 88, 40, 0.22);
}

/* ── entrance: each fan turns face-on, then its painting settles ── */
.pcard-enter .fn-fan {
  animation: fn-open 0.85s cubic-bezier(0.22, 1, 0.36, 1) backwards;
  animation-delay: calc(min(var(--i, 0), 24) * 0.05s);
}
@keyframes fn-open {
  from {
    opacity: 0;
    transform: rotateY(84deg) translateY(10px);
  }
}
.pcard-enter .fn-motif,
.pcard-enter .fn-cols {
  animation: fn-ink 1s ease-out backwards;
  animation-delay: calc(min(var(--i, 0), 24) * 0.05s + 0.35s);
}
@keyframes fn-ink {
  from {
    opacity: 0;
    filter: blur(3px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .pcard:hover .fn-fan,
  .pcard:hover .fn-tassel,
  .pcard:hover .fn-sheen,
  .pcard-enter .fn-fan,
  .pcard-enter .fn-motif,
  .pcard-enter .fn-cols {
    animation: none;
  }
  .fn-bloom {
    transition: none;
  }
}
</style>
