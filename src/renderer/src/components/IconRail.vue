<template>
  <nav class="icon-rail" :aria-label="t('rail.views')">
    <div class="rail-views">
      <!-- The active pill glides between buttons instead of blinking -->
      <span
        v-if="activeIndex >= 0"
        class="rail-indicator"
        :style="{ transform: `translateY(${activeIndex * STEP}px)` }"
        aria-hidden="true"
      ></span>
      <button
        v-for="(v, i) in visibleViews"
        :key="v.id"
        class="rail-btn"
        :class="{ active: store.activeView === v.id }"
        :aria-label="t('rail.' + v.id)"
        :aria-current="store.activeView === v.id ? 'page' : undefined"
        :data-tip="t('rail.' + v.id)"
        :data-key="i < 9 ? '  ·  Alt+' + (i + 1) : ''"
        @click="store.activeView = v.id"
      >
        <UiIcon class="rail-icon" :name="v.id" :size="18" :stroke="1.7" />
      </button>
    </div>

    <div class="rail-sep"></div>

    <button
      class="rail-btn rail-add"
      :aria-label="t('rail.addPerson')"
      :data-tip="t('rail.addPerson')"
      data-key="  ·  Alt+N"
      @click="store.openForm()"
    >
      <UiIcon class="rail-icon" name="add" :size="18" :stroke="2.1" />
    </button>

    <div class="rail-spacer"></div>

    <button
      v-if="store.caps.style !== 'none'"
      class="rail-btn rail-style"
      :class="{ active: store.settingsOpen }"
      :aria-label="t('rail.style')"
      :data-tip="t('rail.style')"
      @click="store.toggleSettings()"
    >
      <UiIcon class="rail-icon" name="style" :size="18" :stroke="1.7" />
    </button>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import { useMainStore } from '../store/index.js'
import { useI18n } from '../i18n'
import UiIcon from './ui/UiIcon.js'

// The slim left icon rail: the views + add + style. Everything that used to
// live in the old left sidebar (stats, export/import, save, the Present date)
// now lives in the Project ▾ menu. Alt+1…7 / Alt+N (App.vue) mirror it.
const store = useMainStore()
const { t } = useI18n()

const views = ['graph', 'directory', 'relationships', 'timeline', 'groups', 'map', 'character']
// Program-mode gating: Simple shows Graph + Directory only; the Character
// view appears only when caps.views includes it (Advanced + Labs).
const visibleViews = computed(() =>
  views.filter((id) => store.caps.views.includes(id)).map((id) => ({ id }))
)
const activeIndex = computed(() => visibleViews.value.findIndex((v) => v.id === store.activeView))
const STEP = 44 // button height (40) + gap (4)
</script>

<style scoped>
.icon-rail {
  position: relative;
  z-index: 20; /* tooltips float over the canvas */
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 0;
  background: var(--surface);
  border-right: 1px solid var(--border);
  user-select: none;
}

.rail-views {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rail-indicator {
  position: absolute;
  top: 0;
  left: 0;
  width: 40px;
  height: 40px;
  border-radius: var(--r-md);
  background: var(--adim);
  box-shadow: inset 0 0 0 1px rgba(var(--accent-rgb), 0.25);
  transition: transform 0.42s var(--ease-spring);
  pointer-events: none;
}
/* The accent tick on the rail's edge rides along with the pill */
.rail-indicator::before {
  content: '';
  position: absolute;
  left: -8px;
  top: 10px;
  bottom: 10px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--accent);
  box-shadow: 0 0 10px rgba(var(--accent-rgb), 0.7);
}

.rail-btn {
  position: relative;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: var(--r-md);
  background: transparent;
  color: var(--t2);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background var(--dur-fast),
    color var(--dur-fast);
}

.rail-btn:hover {
  background: var(--hover);
  color: var(--t1);
}

.rail-views .rail-btn:hover {
  background: rgba(var(--accent-rgb), 0.06);
}

.rail-btn.active {
  color: var(--accent);
}

.rail-style.active {
  background: var(--adim);
}

.rail-icon {
  display: block;
  transition: transform var(--dur-slow) var(--ease-spring);
}

.rail-btn:hover .rail-icon {
  transform: scale(1.12);
}

.rail-btn.active .rail-icon {
  animation: rail-pop 0.45s var(--ease-spring);
}

@keyframes rail-pop {
  40% {
    transform: scale(1.22) rotate(-6deg);
  }
}

.rail-add:hover .rail-icon {
  transform: rotate(90deg) scale(1.1);
}
.rail-add:hover {
  color: var(--accent);
}

.rail-style:hover .rail-icon {
  transform: rotate(-18deg) scale(1.1);
}

/* Flyout label: the view's name + its shortcut */
.rail-btn[data-tip]::after {
  content: attr(data-tip) attr(data-key);
  position: absolute;
  left: calc(100% + 12px);
  top: 50%;
  transform: translate(-6px, -50%) scale(0.96);
  padding: 5px 10px;
  border-radius: var(--r-sm);
  background: var(--glass-soft);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  color: var(--t1);
  font-size: 12.5px;
  font-weight: 600;
  white-space: pre;
  opacity: 0;
  pointer-events: none;
  transition:
    opacity var(--dur) ease,
    transform var(--dur-slow) var(--ease-out);
}
.rail-btn:hover::after,
.rail-btn:focus-visible::after {
  opacity: 1;
  transform: translate(0, -50%) scale(1);
  transition-delay: 0.25s;
}
.rail-sep {
  width: 24px;
  height: 1px;
  background: var(--border);
  margin: 6px 0;
}

.rail-spacer {
  flex: 1;
}

/* ── 水墨 ink theme: the rail is a bundle of bamboo slips (竹简) bound with
   cord; the active view is stamped with a cinnabar seal ─────────────────── */
:root[data-theme='ink'] .icon-rail {
  border-right: 1px solid rgba(70, 48, 22, 0.35);
  background:
    /* slip seams */
    repeating-linear-gradient(90deg, rgba(80, 55, 22, 0.28) 0 1px, transparent 1px 11px),
    /* each slip is rounded: darker edges, a light spine */
    repeating-linear-gradient(
        90deg,
        rgba(120, 88, 40, 0.16) 0,
        rgba(255, 245, 215, 0.2) 4px,
        rgba(255, 245, 215, 0.06) 7px,
        rgba(120, 88, 40, 0.14) 11px
      ),
    /* the bamboo's long grain */ var(--ink-paper-light, none) 0 0 / 160px 512px,
    linear-gradient(180deg, #e3d1a0, #d8c18a 45%, #ddc894);
  background-blend-mode: normal, normal, multiply, normal;
  box-shadow: inset -6px 0 10px -8px rgba(60, 38, 12, 0.45);
}
/* binding cords across the slips, top and bottom */
:root[data-theme='ink'] .icon-rail::before,
:root[data-theme='ink'] .icon-rail::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 3px;
  pointer-events: none;
  background: repeating-linear-gradient(
    115deg,
    #4d3219 0 2px,
    #80592f 2px 3.5px,
    #5b3c1e 3.5px 5px
  );
  box-shadow: 0 1px 1px rgba(40, 24, 8, 0.35);
  opacity: 0.85;
}
:root[data-theme='ink'] .icon-rail::before {
  top: 4px;
}
:root[data-theme='ink'] .icon-rail::after {
  bottom: 4px;
}
:root[data-theme='ink'] .rail-btn {
  color: #5a4426;
  border-radius: 3px;
  background: radial-gradient(closest-side, rgba(40, 26, 10, 0.16), transparent) center / 0% 0%
    no-repeat;
  transition:
    background-size 0.5s var(--ease-out),
    color var(--dur-fast);
}
:root[data-theme='ink'] .rail-btn:hover,
:root[data-theme='ink'] .rail-views .rail-btn:hover {
  color: #2a1d10;
  background: radial-gradient(closest-side, rgba(40, 26, 10, 0.16), transparent) center / 120% 120%
    no-repeat;
}
/* the seal: cinnabar paste with paper grain, a cut inner border (yin seal) */
:root[data-theme='ink'] .rail-indicator {
  inset: 3px;
  width: 34px;
  height: 34px;
  border-radius: 3px 4px 2px 5px / 4px 2px 5px 3px;
  background:
    var(--ink-paper-light, none) center / 200px 200px,
    var(--accent);
  background-blend-mode: multiply, normal;
  box-shadow:
    inset 0 0 0 2px rgba(251, 244, 230, 0.55),
    inset 0 0 0 3px rgba(90, 15, 10, 0.25),
    0 1px 3px rgba(90, 20, 10, 0.35);
  transform-origin: center;
  transition: transform 0.5s cubic-bezier(0.3, 1.25, 0.5, 1);
}
:root[data-theme='ink'] .rail-indicator::before {
  display: none;
}
:root[data-theme='ink'] .rail-btn.active,
:root[data-theme='ink'] .rail-btn.active:hover {
  color: #fbf4e6;
  background: none;
}
:root[data-theme='ink'] .rail-btn.active .rail-icon {
  animation: rail-ink-stamp 0.5s cubic-bezier(0.3, 1.25, 0.5, 1);
}
@keyframes rail-ink-stamp {
  0% {
    transform: scale(1.35) rotate(-8deg);
    opacity: 0.4;
  }
  60% {
    transform: scale(0.94) rotate(1deg);
    opacity: 1;
  }
}
:root[data-theme='ink'] .rail-style.active {
  color: var(--accent);
  background: radial-gradient(closest-side, rgba(179, 53, 42, 0.2), transparent);
}
:root[data-theme='ink'] .rail-add:hover {
  color: var(--accent);
}
/* a single dab of ink between the views and the actions */
:root[data-theme='ink'] .rail-sep {
  width: 24px;
  height: 10px;
  background-color: rgba(50, 32, 12, 0.6);
  -webkit-mask: var(--ink-dab) center / 100% 100% no-repeat;
  mask: var(--ink-dab) center / 100% 100% no-repeat;
}
/* the flyout label: a paper tag hung beside the slips */
:root[data-theme='ink'] .rail-btn[data-tip]::after {
  border-radius: 1px;
  background: var(--ink-sheet), var(--surface);
  background-size: 512px 512px;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  border-color: var(--ink-mount-line);
  box-shadow:
    0 0 0 2px var(--ink-silk),
    0 0 0 3px rgba(58, 42, 22, 0.2),
    var(--shadow-sm);
  font-family: var(--font-ink-label);
  font-size: 13px;
  font-weight: 600;
  color: var(--t1);
}
</style>
