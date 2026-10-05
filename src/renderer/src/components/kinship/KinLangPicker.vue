<template>
  <!-- The kinship naming-language switch: a tiny segmented pill whose thumb
       glides between EN · NO · 简 · 繁. -->
  <div class="klp" role="radiogroup" aria-label="Kinship naming language">
    <span class="klp-thumb" :style="{ transform: `translateX(${idx * 100}%)` }"></span>
    <button
      v-for="l in KIN_LANGS"
      :key="l.code"
      class="klp-btn"
      :class="{ on: l.code === kinLang }"
      role="radio"
      :aria-checked="l.code === kinLang"
      :title="`Name relatives in ${l.label}`"
      @click="setKinLang(l.code)"
    >
      {{ l.short }}
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { KIN_LANGS } from './kinshipNames'
import { kinLang, setKinLang } from './kinshipLang'

const idx = computed(() =>
  Math.max(
    0,
    KIN_LANGS.findIndex((l) => l.code === kinLang.value)
  )
)
</script>

<style scoped>
.klp {
  position: relative;
  display: inline-grid;
  grid-auto-flow: column;
  grid-auto-columns: 26px;
  padding: 2px;
  border-radius: var(--r-pill);
  background: var(--elevated);
  border: 1px solid var(--border);
  flex-shrink: 0;
}
.klp-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 26px;
  height: calc(100% - 4px);
  border-radius: var(--r-pill);
  background: var(--accent);
  box-shadow: 0 2px 8px rgba(var(--accent-rgb), 0.45);
  transition: transform 0.32s var(--ease-spring);
}
.klp-btn {
  position: relative;
  z-index: 1;
  height: 20px;
  border: none;
  background: transparent;
  color: var(--t2);
  font-family: var(--font);
  font-size: 10px;
  font-weight: 800;
  cursor: pointer;
  border-radius: var(--r-pill);
  transition: color 0.2s ease;
}
.klp-btn.on {
  color: var(--on-accent);
}

:root[data-theme='ink'] .klp,
:root[data-theme='ink'] .klp-thumb,
:root[data-theme='ink'] .klp-btn {
  border-radius: 2px;
}
:root[data-theme='ink'] .klp-btn {
  font-family: var(--font-ink-label);
}
</style>
