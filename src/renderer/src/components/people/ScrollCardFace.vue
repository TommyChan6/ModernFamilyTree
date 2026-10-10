<template>
  <!-- 立轴 — a hanging scroll. Everything hangs from the cord's hook so the
       whole mount can sway as one; the painting (画心) sits in silk (绫)
       borders between the top stave (天杆) and the bottom roller (轴). -->
  <div class="sc" :class="['silk-' + silk, { dead: deceased }]" :style="styleVars">
    <div class="sc-hang">
      <svg class="sc-cord" viewBox="0 0 168 22" aria-hidden="true">
        <path d="M14 21 Q84 -6 154 21" />
        <circle cx="84" cy="3.6" r="2.6" />
      </svg>
      <div class="sc-stave"></div>

      <div class="sc-body">
        <!-- 天头 with its two 惊燕 ribbons -->
        <div class="sc-head">
          <i class="sc-ribbon r1"></i>
          <i class="sc-ribbon r2"></i>
        </div>
        <div class="sc-band"></div>

        <!-- 画心 — the painting -->
        <div class="sc-painting">
          <img
            class="sc-land"
            :src="landUrl"
            alt=""
            draggable="false"
            :class="{ faint: !!avatarSrc }"
          />
          <div class="sc-bloom" :style="{ backgroundImage: `url(${bloom})` }"></div>

          <div class="sc-portrait">
            <img
              v-if="avatarSrc"
              class="sc-photo"
              :src="avatarSrc"
              alt=""
              draggable="false"
              decoding="async"
              :style="{ maskImage: `url(${mask})`, webkitMaskImage: `url(${mask})` }"
            />
            <template v-else>
              <img class="sc-enso" :src="enso" alt="" draggable="false" />
              <span class="sc-glyph" :class="{ latin: !cjkGlyph }">{{ glyph }}</span>
            </template>
          </div>

          <div class="sc-cols">
            <span class="sc-name" :class="{ cjk: cjkName, unnamed: !person.name }">{{
              person.name || 'Unnamed'
            }}</span>
            <span class="sc-meta">
              <span v-if="lifeText">{{ lifeText }}</span>
              <span v-if="person.occupation" class="sc-occ">{{ person.occupation }}</span>
            </span>
          </div>
          <img v-if="seal" class="sc-seal" :src="seal" alt="" draggable="false" />

          <span v-if="kin" class="sc-ties" :title="`${kin} ties · ${children} children`">
            <b>{{ kin }}</b> ties<template v-if="children">
              · <b>{{ children }}</b> heirs</template
            >
          </span>
        </div>

        <div class="sc-band"></div>
        <!-- 地头 — lengthens as the scroll unrolls on hover -->
        <div class="sc-foot"></div>
      </div>

      <div class="sc-roller">
        <i class="sc-knob k1"></i>
        <i class="sc-knob k2"></i>
      </div>
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
  ensoUrl,
  miniLandscapeUrl,
  useInkSeal,
  isCjkName
} from './inkPeopleArt'
import { roundelGlyph } from './handscrollLayout'

// The 'scroll' card face (see PersonCard.vue): a hanging scroll whose painting
// is the person's portrait in ink (photo → grayscale/sepia wash multiplied
// into the paper; no photo → an ensō around their brushed initial over misty
// mountains), with the name in a vertical calligraphy column and a cinnabar
// name seal beneath it. Hover sways the mount and unrolls it a little further;
// the entrance unrolls it top → bottom (both driven by PersonCard's classes).

const props = defineProps({
  person: { type: Object, required: true },
  avatarSrc: { type: String, default: '' },
  deceased: { type: Boolean, default: false },
  lifeText: { type: String, default: '' },
  kin: { type: Number, default: 0 },
  children: { type: Number, default: 0 }
})

const seed = computed(() => hashStr(props.person.id || props.person.name || ''))
const silk = computed(() =>
  props.person.gender === 'male' ? 'm' : props.person.gender === 'female' ? 'f' : 'o'
)
const landUrl = computed(() => miniLandscapeUrl(seed.value))
const mask = computed(() => washMaskUrl(seed.value % 4))
const bloom = computed(() => bloomUrl(seed.value % 3))
const enso = computed(() => ensoUrl(seed.value))
const glyph = computed(() => roundelGlyph(props.person.name))
const cjkGlyph = computed(() => /[㐀-鿿]/.test(glyph.value))
const cjkName = computed(() => isCjkName(props.person.name))
const seal = useInkSeal(
  () => props.person.name || '',
  () => props.person.id || '',
  64
)

const styleVars = computed(() => ({
  '--sc-paper': `url(${paintingPaperUrl()})`,
  // a small per-scroll lean so a wall of them doesn't look machine-hung
  '--sc-lean': ((seed.value % 7) - 3) * 0.12 + 'deg'
}))
</script>

<style scoped>
/* ── The hanging assembly ──────────────────────────────────────────────── */
.sc {
  --silk: #a9b4ad;
  --silk-deep: #8c9a93;
  --band: #6d5a3e;
  --wood: #3b2a1d;
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.sc.silk-f {
  --silk: #b9a6a1;
  --silk-deep: #9d8781;
}
.sc.silk-o {
  --silk: #b6ab8f;
  --silk-deep: #9a8f72;
}
.sc-hang {
  position: absolute;
  inset: 0;
  transform-origin: 50% 2px;
  transform: rotate(var(--sc-lean, 0deg));
  transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}
.sc-cord {
  position: absolute;
  left: 21px;
  top: -6px;
  width: 168px;
  height: 22px;
  overflow: visible;
}
.sc-cord path {
  fill: none;
  stroke: #6b5a44;
  stroke-width: 1.3;
}
.sc-cord circle {
  fill: #2c241c;
}
/* 天杆 — the flat top stave */
.sc-stave {
  position: absolute;
  left: 17px;
  right: 17px;
  top: 12px;
  height: 6px;
  border-radius: 2px;
  background: linear-gradient(180deg, #5b4430, var(--wood) 60%, #22170f);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
  z-index: 2;
}

/* ── Silk mounting ─────────────────────────────────────────────────────── */
.sc-body {
  position: absolute;
  left: 21px;
  right: 21px;
  top: 16px;
  display: flex;
  flex-direction: column;
  /* 绫 — a faint woven diamond over the silk, with a soft sheen */
  background:
    linear-gradient(
      90deg,
      rgba(0, 0, 0, 0.08),
      transparent 18%,
      transparent 82%,
      rgba(0, 0, 0, 0.1)
    ),
    repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.07) 0 1px, transparent 1px 5px),
    repeating-linear-gradient(-45deg, rgba(0, 0, 0, 0.05) 0 1px, transparent 1px 5px), var(--silk);
  box-shadow:
    0 10px 18px -10px rgba(0, 0, 0, 0.55),
    0 2px 4px rgba(0, 0, 0, 0.18);
  padding: 0 9px;
  transition: box-shadow 0.4s ease;
}
.sc-head {
  position: relative;
  height: 42px;
  flex-shrink: 0;
}
/* 惊燕 — two narrow ribbons hanging from the top */
.sc-ribbon {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 5px;
  background: linear-gradient(
    90deg,
    var(--silk-deep),
    color-mix(in srgb, var(--silk-deep) 70%, #fff) 50%,
    var(--silk-deep)
  );
  box-shadow: 0 0 0 0.5px rgba(0, 0, 0, 0.12);
}
.sc-ribbon.r1 {
  left: 33%;
}
.sc-ribbon.r2 {
  left: 64%;
}
/* 隔水 — a narrow brocade band framing the painting */
.sc-band {
  height: 4px;
  flex-shrink: 0;
  margin: 0 -9px;
  background:
    repeating-linear-gradient(90deg, rgba(222, 190, 120, 0.4) 0 1px, transparent 1px 4px),
    var(--band);
}
.sc-foot {
  height: 26px;
  flex-shrink: 0;
  transition: height 0.7s cubic-bezier(0.22, 1, 0.36, 1);
}

/* ── 画心 the painting ──────────────────────────────────────────────────── */
.sc-painting {
  position: relative;
  height: 176px;
  flex-shrink: 0;
  overflow: hidden;
  background:
    var(--sc-paper) 0 0 / 256px 256px,
    #f6f0e2;
  box-shadow:
    inset 0 0 0 1px rgba(60, 45, 25, 0.18),
    inset 0 0 18px rgba(120, 90, 45, 0.16);
  isolation: isolate;
}
.sc.dead .sc-painting {
  filter: sepia(0.18) saturate(0.85);
}
.sc-land {
  position: absolute;
  left: -6px;
  right: -6px;
  bottom: -4px;
  width: calc(100% + 12px);
  height: 84px;
  object-fit: cover;
  object-position: center bottom;
  opacity: 0.85;
  mix-blend-mode: multiply;
}
.sc-land.faint {
  opacity: 0.42;
  height: 60px;
}
.sc-bloom {
  position: absolute;
  left: 2px;
  top: 14px;
  width: 104px;
  height: 104px;
  background-size: cover;
  opacity: 0;
  transform: scale(0.6);
  mix-blend-mode: multiply;
  transition:
    opacity 0.9s ease,
    transform 1.4s cubic-bezier(0.22, 1, 0.36, 1);
}
.sc-portrait {
  position: absolute;
  left: 8px;
  top: 18px;
  width: 92px;
  height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.9s cubic-bezier(0.22, 1, 0.36, 1);
}
.sc-photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
  /* ink-toned: monochrome, warmed, pressed into the paper */
  filter: grayscale(1) sepia(0.32) contrast(1.18) brightness(1.06);
  mix-blend-mode: multiply;
}
.sc-enso {
  position: absolute;
  inset: 2px;
  width: calc(100% - 4px);
  height: calc(100% - 4px);
  opacity: 0.82;
  mix-blend-mode: multiply;
}
.sc-glyph {
  position: relative;
  font-family: var(--font-xing);
  font-size: 40px;
  line-height: 1;
  color: var(--ink-black);
  opacity: 0.86;
  transform: translateY(1px);
}
.sc-glyph.latin {
  font-family: var(--font-brush);
  font-size: 28px;
  letter-spacing: 0.5px;
}

/* Vertical calligraphy: the name, then dates + calling in a smaller hand. */
.sc-cols {
  position: absolute;
  right: 7px;
  top: 9px;
  bottom: 30px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  writing-mode: vertical-rl;
}
.sc-name {
  font-family: var(--font-brush);
  font-size: 17px;
  line-height: 1.15;
  color: var(--ink-black);
  max-height: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: 0.5px;
}
.sc-name.cjk {
  font-size: 22px;
  letter-spacing: 3px;
}
.sc-name.unnamed {
  opacity: 0.5;
}
.sc-meta {
  display: flex;
  flex-direction: column;
  gap: 1px;
  font-family: var(--font-ink-serif);
  font-size: 10.5px;
  line-height: 1.25;
  color: #5d5246;
  max-height: 100%;
  overflow: hidden;
  white-space: nowrap;
  padding-top: 3px;
}
.sc-occ {
  font-style: italic;
  opacity: 0.85;
  max-height: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* 名章 under the name column */
.sc-seal {
  position: absolute;
  right: 9px;
  bottom: 9px;
  width: 19px;
  height: 19px;
  opacity: 0.9;
  mix-blend-mode: multiply;
  transform: rotate(-2deg);
  transition:
    transform 0.4s cubic-bezier(0.34, 1.4, 0.5, 1),
    opacity 0.4s ease;
}
.sc-ties {
  position: absolute;
  left: 9px;
  bottom: 5px;
  font-family: var(--font-ink-serif);
  font-size: 9.5px;
  color: rgba(40, 32, 22, 0.62);
  letter-spacing: 0.3px;
  white-space: nowrap;
}
.sc-ties b {
  font-weight: 600;
  color: rgba(40, 32, 22, 0.85);
}

/* ── 轴 the bottom roller + knobs ───────────────────────────────────────── */
.sc-roller {
  position: absolute;
  left: 14px;
  right: 14px;
  top: 272px;
  height: 11px;
  border-radius: 5px;
  background: linear-gradient(180deg, #6a4e35 0%, #3b2a1d 45%, #1f150d 100%);
  box-shadow: 0 4px 6px -2px rgba(0, 0, 0, 0.5);
  transition: transform 0.7s cubic-bezier(0.22, 1, 0.36, 1);
}
/* 轴头 — pale jade knobs */
.sc-knob {
  position: absolute;
  top: -3px;
  width: 9px;
  height: 17px;
  border-radius: 3px;
  background: linear-gradient(90deg, #8c9c8a, #d8e0cf 45%, #9aa995 70%, #6f7d6c);
  box-shadow: 0 2px 3px rgba(0, 0, 0, 0.35);
}
.sc-knob.k1 {
  left: -8px;
}
.sc-knob.k2 {
  right: -8px;
}

/* ── Hover: sway, unroll further, ink blooms ───────────────────────────── */
.pcard:hover .sc-hang {
  animation: sc-sway 2.6s cubic-bezier(0.37, 0, 0.3, 1) both;
}
@keyframes sc-sway {
  0% {
    transform: rotate(var(--sc-lean, 0deg));
  }
  18% {
    transform: rotate(1.6deg);
  }
  42% {
    transform: rotate(-1.05deg);
  }
  64% {
    transform: rotate(0.55deg);
  }
  84% {
    transform: rotate(-0.2deg);
  }
  100% {
    transform: rotate(0deg);
  }
}
.pcard:hover .sc-foot {
  height: 36px;
}
.pcard:hover .sc-roller {
  transform: translateY(10px);
}
.pcard:hover .sc-bloom {
  opacity: 0.32;
  transform: scale(1.15);
}
.pcard:hover .sc-portrait {
  transform: scale(1.04);
}
.pcard:hover .sc-seal {
  opacity: 1;
  transform: rotate(-2deg) scale(1.12);
}
.pcard:hover .sc-body {
  box-shadow:
    0 18px 26px -12px rgba(0, 0, 0, 0.6),
    0 2px 5px rgba(0, 0, 0, 0.2);
}
.pcard.selected .sc-body {
  box-shadow:
    0 0 0 2px var(--accent),
    0 0 22px -4px rgba(var(--accent-rgb), 0.55),
    0 10px 18px -10px rgba(0, 0, 0, 0.55);
}

/* ── Entrance: the scroll unrolls top → bottom ─────────────────────────── */
.pcard-enter .sc-body {
  animation: sc-unroll 0.95s cubic-bezier(0.45, 0, 0.2, 1) backwards;
  animation-delay: calc(min(var(--i, 0), 24) * 0.055s + 0.12s);
}
@keyframes sc-unroll {
  from {
    clip-path: inset(0 0 100% 0);
  }
  to {
    clip-path: inset(0 0 0 0);
  }
}
.pcard-enter .sc-roller {
  animation: sc-roll-down 0.95s cubic-bezier(0.45, 0, 0.2, 1) backwards;
  animation-delay: calc(min(var(--i, 0), 24) * 0.055s + 0.12s);
}
@keyframes sc-roll-down {
  from {
    transform: translateY(-258px) scaleY(1.25);
  }
  to {
    transform: none;
  }
}
.pcard-enter .sc-stave,
.pcard-enter .sc-cord {
  animation: sc-fade 0.35s ease backwards;
  animation-delay: calc(min(var(--i, 0), 24) * 0.055s);
}
@keyframes sc-fade {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .pcard:hover .sc-hang,
  .pcard-enter .sc-body,
  .pcard-enter .sc-roller,
  .pcard-enter .sc-stave,
  .pcard-enter .sc-cord {
    animation: none;
  }
  .sc-foot,
  .sc-roller,
  .sc-bloom,
  .sc-portrait {
    transition: none;
  }
}
</style>
