<template>
  <div class="st-sheet">
    <!-- The app layer: what every view paints with. -->
    <!-- ── Theme + accent ── -->
    <template v-if="chapter === 'theme'">
      <section class="st-section" data-skey="theme">
        <h4 class="st-sec-title">{{ t('settings.theme.title') }}</h4>
        <div class="ast-themes">
          <button
            v-for="(th, i) in THEMES"
            :key="th"
            class="ast-theme"
            :class="['ast-' + th, { on: store.theme === th }]"
            :style="{ '--i': i }"
            :aria-pressed="store.theme === th"
            @click="pickTheme(th, $event)"
          >
            <!-- a tiny window of the app in that theme; the accent is live -->
            <span class="ast-win" aria-hidden="true">
              <i class="ast-bar"></i>
              <i class="ast-rail"></i>
              <svg class="ast-art" viewBox="0 0 60 34">
                <path
                  class="ast-link"
                  d="M14 9 Q30 4 44 10 M30 7 Q30 18 22 25 M30 7 Q32 18 40 26"
                />
                <circle class="ast-node ast-a" cx="14" cy="9" r="3.6" />
                <circle class="ast-node ast-b" cx="44" cy="10" r="3.6" />
                <circle class="ast-node ast-c" cx="22" cy="25" r="3.2" />
                <circle class="ast-node ast-acc" cx="40" cy="26" r="3.2" />
              </svg>
            </span>
            <span class="ast-theme-name">
              <span v-if="th === 'ink'" class="ast-seal">墨</span>
              <UiIcon v-else :name="THEME_ICONS[th]" :size="14" />
              {{ t('settings.theme.' + th) }}
            </span>
          </button>
        </div>
      </section>

      <section class="st-section" data-skey="accent">
        <h4 class="st-sec-title">{{ t('settings.accent.title') }}</h4>
        <p class="st-note">
          {{
            store.isInk
              ? t('settings.accent.inkNote')
              : store.isMedieval
                ? t('settings.accent.medievalNote')
                : t('settings.accent.desc')
          }}
        </p>
        <div class="ast-accents">
          <button
            v-for="(a, i) in ACCENT_PRESETS"
            :key="a.id"
            class="ast-accent"
            :class="{ on: store.accent === a.hex }"
            :style="{ '--sw': a.hex, '--i': i }"
            :title="t('settings.accent.presets.' + a.id)"
            :aria-label="t('settings.accent.presets.' + a.id)"
            :aria-pressed="store.accent === a.hex"
            @click="pickAccent(a.hex)"
          >
            <UiIcon class="ast-accent-check" name="check" :size="13" :stroke="3" />
          </button>
          <label
            class="ast-accent ast-accent-custom"
            :class="{ on: isCustomAccent }"
            :style="{ '--sw': store.accent, '--i': ACCENT_PRESETS.length }"
            :title="t('settings.accent.custom')"
          >
            <input
              type="color"
              :value="store.accent"
              :aria-label="t('settings.accent.custom')"
              @input="onCustomAccent"
              @change="onCustomAccent"
            />
            <UiIcon name="plus" :size="14" :stroke="2.5" />
          </label>
        </div>
        <button
          v-if="store.accent !== DEFAULT_ACCENT"
          class="btn btn-ghost btn-xs ast-accent-reset"
          @click="pickAccent(DEFAULT_ACCENT)"
        >
          <UiIcon name="rotate-ccw" :size="13" />{{ t('settings.accent.reset') }}
        </button>
      </section>
    </template>

    <!-- ── Shared palette ── -->
    <template v-else-if="chapter === 'palette'">
      <p class="st-note">{{ t('styleStudio.palette.intro') }}</p>
      <!-- A living specimen: a little family drawn in the palette -->
      <svg
        class="ast-specimen"
        viewBox="0 0 280 92"
        role="img"
        :aria-label="t('styleStudio.palette.specimen')"
      >
        <defs>
          <linearGradient :id="gradId" x1="0" x2="1">
            <stop offset="0" :stop-color="gs.maleColor" />
            <stop offset="1" :stop-color="gs.femaleColor" />
          </linearGradient>
        </defs>
        <path class="ast-sp-line" :stroke="gs.spouseColor" stroke-dasharray="5 4" d="M98 22 H182" />
        <path
          class="ast-sp-line"
          :stroke="gs.parentChildColor"
          d="M140 22 V40 Q140 50 128 54 L104 62"
        />
        <path
          class="ast-sp-line"
          :stroke="gs.parentChildColor"
          d="M140 40 Q140 50 152 54 L176 62"
        />
        <path
          class="ast-sp-line"
          :stroke="gs.adoptedColor"
          stroke-dasharray="3 4"
          d="M140 40 V66"
        />
        <circle class="ast-sp-node" cx="88" cy="22" r="10" :fill="gs.maleColor" />
        <circle class="ast-sp-node" cx="192" cy="22" r="10" :fill="gs.femaleColor" />
        <circle class="ast-sp-node ast-sp-d1" cx="98" cy="66" r="8" :fill="gs.unknownColor" />
        <circle class="ast-sp-node ast-sp-d2" cx="140" cy="74" r="8" :fill="gs.femaleColor" />
        <circle class="ast-sp-node ast-sp-d3" cx="182" cy="66" r="8" :fill="gs.maleColor" />
        <rect x="18" y="86" width="244" height="4" rx="2" :fill="`url(#${gradId})`" />
      </svg>

      <section class="st-section">
        <h4 class="st-sec-title">{{ t('styleStudio.palette.people') }}</h4>
        <StColor
          v-for="p in PEOPLE"
          :key="p.key"
          :skey="p.key"
          :label="t(p.labelKey)"
          :model-value="gs[p.key]"
          @update:model-value="setG(p.key, $event)"
        >
          <template #lead><i class="ast-dot" :style="{ background: gs[p.key] }"></i></template>
        </StColor>
      </section>
      <section class="st-section">
        <h4 class="st-sec-title">{{ t('styleStudio.palette.bonds') }}</h4>
        <StColor
          v-for="b in BONDS"
          :key="b.key"
          :skey="b.key"
          :label="t(b.labelKey)"
          :model-value="gs[b.key]"
          @update:model-value="setG(b.key, $event)"
        >
          <template #lead>
            <i class="ast-bond" :class="{ dashed: b.dashed }" :style="{ color: gs[b.key] }"></i>
          </template>
        </StColor>
      </section>
      <!-- The Dynamics lens's warm ↔ cold ramp ('' = the theme's default) -->
      <section class="st-section">
        <h4 class="st-sec-title">{{ t('sentiment.style.title') }}</h4>
        <div
          class="ast-dyn-ramp"
          :style="{ background: `linear-gradient(90deg, ${dynGradient})` }"
          aria-hidden="true"
        ></div>
        <StColor
          v-for="d in DYNAMICS"
          :key="d.key"
          :skey="d.key"
          :label="t(d.labelKey)"
          :model-value="store.dynamicsPalette[d.side]"
          @update:model-value="setG(d.key, $event)"
        >
          <template #lead>
            <i class="ast-bond" :style="{ color: store.dynamicsPalette[d.side] }"></i>
          </template>
        </StColor>
      </section>
      <p class="st-hint">
        <UiIcon name="wand-sparkles" :size="13" />{{ t('styleStudio.palette.lookNote') }}
      </p>
    </template>

    <!-- ── Profiles ── -->
    <template v-else-if="chapter === 'profiles'">
      <p class="st-note">{{ t('styleStudio.profile.intro') }}</p>
      <div class="ast-profiles" data-skey="profileStyle">
        <button
          v-for="(p, i) in PROFILES"
          :key="p.id"
          class="ast-profile"
          :class="['ast-pf-' + p.id, { on: store.profileStyle === p.id }]"
          :style="{ '--i': i }"
          :aria-pressed="store.profileStyle === p.id"
          @click="store.setProfileStyle(p.id)"
        >
          <span class="ast-pf-art" aria-hidden="true">
            <i class="ast-pf-hero"></i>
            <i class="ast-pf-face"></i>
            <i class="ast-pf-l1"></i>
            <i class="ast-pf-l2"></i>
            <i class="ast-pf-l3"></i>
          </span>
          <span class="ast-pf-name"
            ><UiIcon :name="p.icon" :size="14" />{{ t('personModal.styles.' + p.id) }}</span
          >
          <span class="ast-pf-desc">{{ t('personModal.styleTitles.' + p.id) }}</span>
        </button>
      </div>
    </template>

    <!-- ── Special effects (tag / trait auras) ── -->
    <section v-else-if="chapter === 'auras'" class="st-section" data-skey="auras">
      <AurasSheet />
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useMainStore } from '../../store/index.js'
import { useI18n } from '../../i18n'
import { ACCENT_PRESETS, DEFAULT_ACCENT } from '../../lib/accent.js'
import { THEME_KEYS } from '../graph/graphThemes.js'
import UiIcon from '../ui/UiIcon.js'
import StColor from './StColor.vue'
import AurasSheet from '../auras/AurasSheet.vue'
import { sentimentGradient } from '../../../../shared/sentiment'

defineProps({ chapter: { type: String, required: true } })

const store = useMainStore()
const { t } = useI18n()
const gs = computed(() => store.graphSettings)
const gradId = `ast-g-${Math.random().toString(36).slice(2, 8)}`

const THEMES = ['dark', 'light', 'ink', 'medieval']
const THEME_ICONS = { dark: 'moon', light: 'sun', medieval: 'castle' }
const PEOPLE = [
  { key: 'maleColor', labelKey: 'data.gender.male' },
  { key: 'femaleColor', labelKey: 'data.gender.female' },
  { key: 'unknownColor', labelKey: 'graphStyle.labels.unknown' }
]
const BONDS = [
  { key: 'parentChildColor', labelKey: 'data.relTypes.parent_child' },
  { key: 'spouseColor', labelKey: 'data.relTypes.spouse', dashed: true },
  { key: 'adoptedColor', labelKey: 'data.relTypes.adopted', dashed: true }
]
const DYNAMICS = [
  { key: 'dynamicsWarm', side: 'warm', labelKey: 'sentiment.style.warm' },
  { key: 'dynamicsCold', side: 'cold', labelKey: 'sentiment.style.cold' }
]
const dynGradient = computed(() => sentimentGradient(store.dynamicsPalette))
const PROFILES = [
  { id: 'cinematic', icon: 'clapperboard' },
  { id: 'scroll', icon: 'scroll' }
]

const isCustomAccent = computed(() => !ACCENT_PRESETS.some((a) => a.hex === store.accent))

function pickTheme(th, e) {
  store.setTheme(th, { origin: { x: e.clientX, y: e.clientY } })
}
function pickAccent(hex) {
  if (hex !== store.accent) store.setAccent(hex)
}
function onCustomAccent(e) {
  // `input` fires continuously while dragging in the native picker — apply
  // live (a few CSS vars) but persist once the picker settles.
  store.setAccent(e.target.value, { persist: e.type === 'change' })
}
// The palette lives in graphSettings (every view reads it from there); hand
// edits make a graph look "custom", exactly as the old panel did.
function setG(key, value) {
  store.updateGraphSetting(key, value)
  if (THEME_KEYS.has(key) && store.graphSettings.themePreset !== 'custom')
    store.updateGraphSetting('themePreset', 'custom')
}
</script>

<style scoped>
/* ── Dynamics ramp (cold → neutral → warm) ── */
.ast-dyn-ramp {
  height: 6px;
  margin: 2px 0 6px;
  border-radius: 3px;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);
}
/* ── Theme windows ── */
.ast-themes {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}
.ast-theme {
  /* preview pigments: each card shows ITS theme, whatever the current one */
  --w-bg: #10131c;
  --w-surface: #1b2030;
  --w-line: rgba(255, 255, 255, 0.28);
  --w-node: #8792b3;
  --w-text: #e8ebf3;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 5px;
  border-radius: var(--r-md);
  border: 1px solid var(--border);
  background: var(--elevated);
  color: var(--t2);
  font-family: var(--font);
  cursor: pointer;
  animation: st-pop-in 0.42s var(--ease-out) backwards;
  animation-delay: calc(var(--i) * 0.05s);
  transition:
    transform 0.25s var(--ease-spring),
    border-color var(--dur) ease,
    box-shadow var(--dur) ease;
}
.ast-light {
  --w-bg: #eef1f7;
  --w-surface: #ffffff;
  --w-line: rgba(30, 40, 70, 0.3);
  --w-node: #8a96b5;
  --w-text: #1c2233;
}
.ast-ink {
  --w-bg: #ece2c9;
  --w-surface: #f6efdc;
  --w-line: rgba(40, 30, 20, 0.6);
  --w-node: #2e2620;
  --w-text: #2a211a;
}
.ast-medieval {
  --w-bg: #e7d5ae;
  --w-surface: #f2e5c6;
  --w-line: rgba(43, 29, 18, 0.62);
  --w-node: #8a641c;
  --w-text: #2a1c10;
}
.ast-theme:hover {
  transform: translateY(-3px) rotate(-1deg);
  border-color: var(--border-strong);
}
.ast-theme.on {
  color: var(--t1);
  border-color: var(--accent);
  box-shadow:
    0 0 0 1px var(--accent),
    0 8px 22px rgba(var(--accent-rgb), 0.28);
}
.ast-win {
  position: relative;
  display: block;
  aspect-ratio: 16 / 11;
  border-radius: 6px;
  overflow: hidden;
  background: var(--w-bg);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);
}
.ast-ink .ast-win {
  background:
    radial-gradient(120% 90% at 70% 30%, rgba(255, 250, 235, 0.6), transparent 60%), var(--w-bg);
}
.ast-medieval .ast-win {
  background:
    radial-gradient(120% 95% at 50% 40%, transparent 50%, rgba(90, 52, 16, 0.22)), var(--w-bg);
}
/* the leather spine and the gilt rule under the headband */
.ast-medieval .ast-rail {
  background: linear-gradient(180deg, #5a1d15, #6d2419 50%, #4a160f);
}
.ast-medieval .ast-bar {
  box-shadow: 0 1.5px 0 #c9a043;
}
.ast-bar,
.ast-rail {
  position: absolute;
  display: block;
  background: var(--w-surface);
}
.ast-bar {
  inset: 0 0 auto 0;
  height: 16%;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.08);
}
.ast-rail {
  top: 16%;
  bottom: 0;
  left: 0;
  width: 13%;
}
.ast-art {
  position: absolute;
  left: 16%;
  right: 3%;
  top: 20%;
  bottom: 4%;
  width: 81%;
  height: 76%;
}
.ast-link {
  fill: none;
  stroke: var(--w-line);
  stroke-width: 1.3;
  stroke-linecap: round;
}
.ast-ink .ast-link {
  stroke-width: 1.8;
}
.ast-node {
  fill: var(--w-node);
}
.ast-acc {
  fill: var(--accent);
}
.ast-ink .ast-acc {
  fill: #b3352a; /* ink locks its cinnabar accent */
}
.ast-medieval .ast-acc {
  fill: #24478a; /* medieval locks its lapis accent */
}
.ast-theme.on .ast-node {
  animation: st-breathe 2.4s ease-in-out infinite;
  transform-box: fill-box;
  transform-origin: center;
}
.ast-theme.on .ast-b {
  animation-delay: 0.4s;
}
.ast-theme.on .ast-c {
  animation-delay: 0.8s;
}
.ast-theme-name {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 700;
  padding-bottom: 2px;
}
.ast-seal {
  display: inline-grid;
  place-items: center;
  width: 15px;
  height: 15px;
  border-radius: 3px;
  background: var(--danger);
  color: var(--on-accent);
  font-size: 10px;
  line-height: 1;
}

/* ── Accent swatches ── */
.ast-accents {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.ast-accent {
  position: relative;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 50%;
  border: none;
  background: var(--sw);
  color: #fff;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.18);
  animation: st-pop-in 0.4s var(--ease-spring) backwards;
  animation-delay: calc(var(--i) * 0.03s);
  transition: transform 0.25s var(--ease-spring);
}
.ast-accent:hover {
  transform: scale(1.14);
}
.ast-accent.on {
  box-shadow:
    0 0 0 2px var(--surface),
    0 0 0 4px var(--sw),
    0 4px 14px color-mix(in srgb, var(--sw) 55%, transparent);
}
.ast-accent-check {
  opacity: 0;
  transform: scale(0.4);
  transition:
    opacity var(--dur) ease,
    transform 0.3s var(--ease-spring);
}
.ast-accent.on .ast-accent-check {
  opacity: 1;
  transform: scale(1);
}
.ast-accent-custom {
  background: conic-gradient(from 0deg, #ff6b6b, #ffd166, #5ce1a4, #4fb4ff, #b18cff, #ff6b6b);
}
.ast-accent-custom input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
.ast-accent-reset {
  align-self: flex-start;
  gap: 5px;
}

/* ── Palette specimen ── */
.ast-specimen {
  width: 100%;
  height: auto;
  padding: 10px 6px 6px;
  border-radius: var(--r-md);
  border: 1px solid var(--border);
  background:
    radial-gradient(100% 120% at 50% 0%, rgba(var(--accent-rgb), 0.08), transparent 70%),
    var(--elevated);
}
.ast-sp-line {
  fill: none;
  stroke-width: 2.2;
  stroke-linecap: round;
  transition: stroke 0.3s ease;
}
.ast-sp-node {
  stroke: var(--surface);
  stroke-width: 2;
  transition: fill 0.3s ease;
  transform-box: fill-box;
  transform-origin: center;
  animation: st-pop-in 0.5s var(--ease-spring) backwards;
}
.ast-sp-d1 {
  animation-delay: 0.08s;
}
.ast-sp-d2 {
  animation-delay: 0.14s;
}
.ast-sp-d3 {
  animation-delay: 0.2s;
}
.ast-dot {
  display: block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.2);
}
.ast-bond {
  display: block;
  width: 18px;
  border-top: 2.5px solid currentColor;
}
.ast-bond.dashed {
  border-top-style: dashed;
}

/* ── Profile cards ── */
.ast-profiles {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.ast-profile {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 6px 9px;
  border-radius: var(--r-md);
  border: 1px solid var(--border);
  background: var(--elevated);
  color: var(--t2);
  font-family: var(--font);
  text-align: left;
  cursor: pointer;
  animation: st-pop-in 0.42s var(--ease-out) backwards;
  animation-delay: calc(var(--i) * 0.06s);
  transition:
    transform 0.25s var(--ease-spring),
    border-color var(--dur) ease,
    box-shadow var(--dur) ease;
}
.ast-profile:hover {
  transform: translateY(-3px);
  border-color: var(--border-strong);
}
.ast-profile.on {
  color: var(--t1);
  border-color: var(--accent);
  box-shadow:
    0 0 0 1px var(--accent),
    0 8px 22px rgba(var(--accent-rgb), 0.25);
}
.ast-pf-art {
  position: relative;
  display: block;
  aspect-ratio: 4 / 3;
  border-radius: 6px;
  overflow: hidden;
  background: var(--surface);
}
.ast-pf-art i {
  position: absolute;
  display: block;
}
.ast-pf-cinematic .ast-pf-hero {
  inset: 0 0 45% 0;
  background: linear-gradient(160deg, rgba(var(--accent-rgb), 0.75), rgba(var(--accent-rgb), 0.15));
}
.ast-pf-cinematic .ast-pf-face {
  left: 10%;
  top: 38%;
  width: 26%;
  aspect-ratio: 1;
  border-radius: 50%;
  background: var(--t3);
  box-shadow: 0 0 0 2px var(--surface);
}
.ast-pf-art .ast-pf-l1,
.ast-pf-art .ast-pf-l2,
.ast-pf-art .ast-pf-l3 {
  height: 5%;
  border-radius: 2px;
  background: var(--border-strong);
}
.ast-pf-cinematic .ast-pf-l1 {
  left: 42%;
  top: 60%;
  width: 46%;
  background: var(--t2);
}
.ast-pf-cinematic .ast-pf-l2 {
  left: 10%;
  top: 76%;
  width: 78%;
}
.ast-pf-cinematic .ast-pf-l3 {
  left: 10%;
  top: 86%;
  width: 56%;
}
/* the scroll: a hanging scroll with rollers, a seal and vertical lines */
.ast-pf-scroll .ast-pf-art {
  background:
    linear-gradient(90deg, transparent 18%, rgba(140, 100, 50, 0.12) 18% 82%, transparent 82%),
    var(--surface);
}
.ast-pf-scroll .ast-pf-hero {
  left: 14%;
  right: 14%;
  top: 4%;
  height: 7%;
  border-radius: 3px;
  background: var(--t3);
}
.ast-pf-scroll .ast-pf-face {
  left: 14%;
  right: 14%;
  bottom: 4%;
  height: 7%;
  border-radius: 3px;
  background: var(--t3);
}
.ast-pf-scroll .ast-pf-l1,
.ast-pf-scroll .ast-pf-l2 {
  top: 20%;
  width: 5%;
  height: 52%;
  background: var(--t2);
}
.ast-pf-scroll .ast-pf-l1 {
  right: 34%;
}
.ast-pf-scroll .ast-pf-l2 {
  right: 46%;
  height: 40%;
}
.ast-pf-scroll .ast-pf-l3 {
  left: 28%;
  bottom: 20%;
  width: 10%;
  height: 12%;
  background: var(--danger);
}
.ast-pf-name {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--t1);
}
.ast-pf-desc {
  font-size: 11.5px;
  line-height: 1.35;
  color: var(--t3);
}
</style>
