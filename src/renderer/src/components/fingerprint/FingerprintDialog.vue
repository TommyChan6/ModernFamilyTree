<template>
  <Teleport to="body">
    <Transition name="fpd">
      <div v-if="open" class="fpd-backdrop" @click.self="close">
        <div
          class="fpd-panel ink-mount ink-unroll"
          role="dialog"
          aria-modal="true"
          :aria-label="t('fingerprint.title')"
        >
          <button
            class="icon-btn fpd-close"
            :title="t('fingerprint.close')"
            :aria-label="t('fingerprint.close')"
            @click="close"
          >
            <UiIcon name="x" :size="16" />
          </button>

          <div class="fpd-art">
            <FingerprintMandala
              v-if="features"
              class="fpd-mandala"
              :features="features"
              :hue="hue"
              :label="t('fingerprint.ariaOf', { name: projectName })"
              spin
            />
            <div v-else class="fpd-loading"><span class="spinner"></span></div>
          </div>

          <div class="fpd-side">
            <p class="eyebrow">{{ t('fingerprint.title') }}</p>
            <h2 class="fpd-name">{{ projectName }}</h2>
            <p class="fpd-sub">{{ t('fingerprint.subtitle') }}</p>
            <p v-if="features?.partial" class="fpd-note">
              <UiIcon name="info" :size="14" />{{ t('fingerprint.partial') }}
            </p>

            <ul v-if="features" class="fpd-legend">
              <li v-for="row in legend" :key="row.id" class="fpd-row">
                <span class="fpd-glyph" :class="'g-' + row.id" aria-hidden="true"></span>
                <span class="fpd-row-text">
                  <b>{{ t('fingerprint.legend.' + row.id + '.label') }}</b>
                  <span>{{ t('fingerprint.legend.' + row.id + '.text', row) }}</span>
                </span>
              </li>
            </ul>

            <div class="fpd-actions">
              <button class="btn btn-primary btn-sm" :disabled="!features" @click="downloadPng">
                <UiIcon name="image" :size="14" />{{ t('fingerprint.downloadPng') }}
              </button>
              <button class="btn btn-soft btn-sm" :disabled="!features" @click="downloadSvg">
                <UiIcon name="download" :size="14" />{{ t('fingerprint.downloadSvg') }}
              </button>
            </div>
            <p class="fpd-living">{{ t('fingerprint.living') }}</p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
// The large "Family fingerprint" dialog (store.openFingerprint(projectId)):
// the mandala turning slowly, a legend of what encodes what with this
// tree's own numbers, and PNG / SVG downloads drawn from the same shapes.
import { computed, watch, onMounted, onUnmounted } from 'vue'
import { useMainStore } from '../../store/index.js'
import { useI18n } from '../../i18n'
import { defaultNameLabel } from '../../lib/dataLabels'
import { toast } from '../../lib/dialogs.js'
import { buildMandala, drawMandala, mandalaLegend, mandalaToSvg } from '../../lib/familyFingerprint'
import FingerprintMandala from './FingerprintMandala.vue'
import UiIcon from '../ui/UiIcon.js'

const store = useMainStore()
const { t } = useI18n()

const open = computed(() => !!store.fingerprintProjectId && !!store.authUser)
const project = computed(() => store.projects.find((p) => p.id === store.fingerprintProjectId))
const projectName = computed(() => defaultNameLabel(project.value?.name || ''))
const hue = computed(() => (typeof project.value?.hue === 'number' ? project.value.hue : null))
const features = computed(() => store.fingerprintOf(store.fingerprintProjectId))
const legend = computed(() => (features.value ? mandalaLegend(features.value) : []))

function close() {
  store.closeFingerprint()
}

function themeKey() {
  return store.isInk ? 'ink' : store.isMedieval ? 'medieval' : store.isLightTheme ? 'light' : 'dark'
}

function exportMandala() {
  return buildMandala(features.value, {
    theme: themeKey(),
    accent: store.accent,
    hue: hue.value,
    genderColors: [store.graphSettings?.maleColor, store.graphSettings?.femaleColor],
    background: true
  })
}

function fileBase() {
  const base = (project.value?.name || 'family')
    .replace(/[\\/:*?"<>|]+/g, '')
    .trim()
    .slice(0, 60)
  return `${base || 'family'}-fingerprint`
}

function save(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  toast(t('fingerprint.saved', { name }), { tone: 'success' })
}

function downloadPng() {
  if (!features.value) return
  const size = 2048
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  drawMandala(ctx, exportMandala(), size)
  canvas.toBlob((blob) => {
    if (blob) save(blob, fileBase() + '.png')
    else toast(t('fingerprint.failed'), { tone: 'error' })
  }, 'image/png')
}

function downloadSvg() {
  if (!features.value) return
  const svg = mandalaToSvg(exportMandala(), 1024)
  save(new Blob([svg], { type: 'image/svg+xml' }), fileBase() + '.svg')
}

function onKey(e) {
  if (open.value && e.key === 'Escape') {
    e.stopPropagation()
    close()
  }
}
// Signing out (or the project vanishing) closes the dialog.
watch(
  () => open.value && !project.value,
  (gone) => gone && close()
)
onMounted(() => window.addEventListener('keydown', onKey, true))
onUnmounted(() => window.removeEventListener('keydown', onKey, true))
</script>

<style scoped>
.fpd-backdrop {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: grid;
  place-items: center;
  padding: 20px;
  background: color-mix(in srgb, var(--bg) 62%, transparent);
  backdrop-filter: blur(8px);
}

.fpd-panel {
  position: relative;
  width: min(940px, 100%);
  max-height: min(92vh, 760px);
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  border-radius: var(--r-xl);
  background: var(--surface);
  border: 1px solid var(--border-strong);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.fpd-close {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
}

.fpd-art {
  position: relative;
  display: grid;
  place-items: center;
  padding: 28px;
  background:
    radial-gradient(circle at 50% 50%, rgba(var(--accent-rgb), 0.1), transparent 68%), var(--bg);
  border-right: 1px solid var(--border);
}

.fpd-mandala {
  width: min(100%, 460px);
}

.fpd-loading {
  width: min(100%, 460px);
  aspect-ratio: 1;
  display: grid;
  place-items: center;
}

.fpd-side {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 30px 28px 24px;
  overflow-y: auto;
  min-height: 0;
}

.fpd-name {
  margin: 0;
  color: var(--t1);
  font-size: var(--fs-xl, 20px);
  font-weight: 800;
  letter-spacing: -0.2px;
  overflow-wrap: anywhere;
}

.fpd-sub {
  margin: 0;
  color: var(--t2);
  font-size: var(--fs-sm, 13px);
  line-height: 1.5;
}

.fpd-note {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--t3);
  font-size: var(--fs-xs, 12px);
}

.fpd-legend {
  list-style: none;
  margin: 6px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.fpd-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.fpd-row-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  font-size: var(--fs-xs, 12px);
  line-height: 1.4;
  color: var(--t2);
}

.fpd-row-text b {
  color: var(--t1);
  font-weight: 700;
  font-size: var(--fs-sm, 13px);
}

/* Tiny CSS glyphs echoing each motif. */
.fpd-glyph {
  flex: 0 0 18px;
  height: 18px;
  margin-top: 1px;
  border-radius: 50%;
  border: 1.5px solid rgba(var(--accent-rgb), 0.75);
  position: relative;
}
.fpd-glyph.g-rings {
  box-shadow:
    inset 0 0 0 3px var(--surface),
    inset 0 0 0 4.5px rgba(var(--accent-rgb), 0.75);
}
.fpd-glyph.g-petals,
.fpd-glyph.g-shape {
  border-radius: 50% 0;
  transform: rotate(45deg) scale(0.8);
  background: rgba(var(--accent-rgb), 0.3);
}
.fpd-glyph.g-shape {
  border-radius: 80% 0;
}
.fpd-glyph.g-symmetry {
  border-radius: 3px;
  transform: rotate(45deg) scale(0.75);
}
.fpd-glyph.g-rosette {
  background: radial-gradient(circle, transparent 38%, rgba(var(--accent-rgb), 0.35) 40%);
}
.fpd-glyph.g-core {
  background: conic-gradient(var(--accent) 0 50%, var(--t3) 50% 100%);
  border-color: var(--border-strong);
}
.fpd-glyph.g-threads {
  border-style: dashed;
}
.fpd-glyph.g-halo {
  border-style: dotted;
  border-width: 2.5px;
}
.fpd-glyph.g-satellites {
  transform: scale(0.55);
  background: rgba(var(--accent-rgb), 0.4);
}
.fpd-glyph.g-tints {
  background: conic-gradient(
    rgba(var(--accent-rgb), 0.9),
    var(--t3),
    rgba(var(--accent-rgb), 0.4),
    rgba(var(--accent-rgb), 0.9)
  );
  border-color: var(--border-strong);
}

.fpd-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.fpd-actions .btn {
  gap: 6px;
}

.fpd-living {
  margin: 2px 0 0;
  color: var(--t3);
  font-size: var(--fs-xs, 12px);
}

.fpd-enter-active,
.fpd-leave-active {
  transition: opacity var(--dur, 0.22s) ease;
}
.fpd-enter-active .fpd-panel,
.fpd-leave-active .fpd-panel {
  transition: transform 0.32s var(--ease-out, ease-out);
}
.fpd-enter-from,
.fpd-leave-to {
  opacity: 0;
}
.fpd-enter-from .fpd-panel,
.fpd-leave-to .fpd-panel {
  transform: translateY(10px) scale(0.98);
}

@media (max-width: 720px) {
  .fpd-panel {
    grid-template-columns: 1fr;
    overflow-y: auto;
  }
  .fpd-art {
    border-right: 0;
    border-bottom: 1px solid var(--border);
    padding: 18px;
  }
  .fpd-mandala {
    width: min(100%, 300px);
  }
  .fpd-side {
    overflow: visible;
  }
}

@media (prefers-reduced-motion: reduce) {
  .fpd-enter-active,
  .fpd-leave-active,
  .fpd-enter-active .fpd-panel,
  .fpd-leave-active .fpd-panel {
    transition: none;
  }
}
</style>
