<template>
  <div class="ps-overlay" @pointerdown.self="$emit('close')">
    <div class="ps-burst" aria-hidden="true"></div>
    <div class="ps-body">
      <div
        ref="tiltRef"
        class="ps-card"
        :style="tiltStyle"
        @pointermove="onTilt"
        @pointerleave="resetTilt"
      >
        <canvas ref="cardRef" class="ps-canvas"></canvas>
        <div class="ps-holo" aria-hidden="true"></div>
        <div class="ps-glare" aria-hidden="true"></div>
      </div>

      <div class="ps-controls">
        <div class="ps-seg">
          <button :class="{ on: framing === 'portrait' }" @click="framing = 'portrait'">
            <UiIcon name="user-round" :size="14" />
            {{ t('character.photo.portrait') }}
          </button>
          <button :class="{ on: framing === 'full' }" @click="framing = 'full'">
            <UiIcon name="person-standing" :size="14" />
            {{ t('character.photo.full') }}
          </button>
        </div>
        <div class="ps-backdrops">
          <button
            v-for="b in BACKDROPS"
            :key="b.id"
            class="ps-bd"
            :class="{ on: backdrop === b.id }"
            :title="t('character.backdrops.' + b.id)"
            :aria-label="t('character.backdrops.' + b.id)"
            @click="backdrop = b.id"
          >
            <UiIcon :name="b.icon" :size="18" />
          </button>
        </div>
        <div class="ps-actions">
          <button class="btn btn-primary btn-sm" @click="download">
            <UiIcon name="download" :size="14" />
            {{ t('character.photo.download') }}
          </button>
          <button class="btn btn-sm" :disabled="busy" @click="framedPortrait">
            <UiIcon name="image" :size="14" />
            {{ t('character.photo.setFramed') }}
          </button>
          <button class="btn btn-ghost btn-sm" @click="$emit('close')">
            {{ t('character.photo.close') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from '../../i18n'
import { paintCard } from './render/card'
import { BACKDROPS } from './render/backdrops'
import UiIcon from '../ui/UiIcon.js'

// Photo mode: the look as a collectible character card (gacha-reveal
// entrance, pointer-driven 3D tilt with a holographic sheen). Download the
// card as PNG, or push a framed (backdrop-included) portrait to the avatar.

const props = defineProps({
  doc: { type: Object, required: true },
  pack: { type: Object, required: true },
  person: { type: Object, default: null },
  styleLabel: { type: String, default: '' },
  stars: { type: Number, default: 3 },
  busy: { type: Boolean, default: false }
})
const emit = defineEmits(['close', 'set-framed'])
const { t } = useI18n()

const cardRef = ref(null)
const tiltRef = ref(null)
const framing = ref('portrait')
const backdrop = ref(props.doc.backdrop || 'studio')

function theme() {
  const cs = getComputedStyle(document.documentElement)
  const accent = cs.getPropertyValue('--accent').trim()
  return {
    accent: /^#[0-9a-f]{6}$/i.test(accent) ? accent : '#6c8ef5',
    base: cs.getPropertyValue('--bg').trim() || '#0f1117'
  }
}

function lifespan() {
  const b = props.person?.birth?.year
  const d = props.person?.death?.year
  if (b == null && d == null) return ''
  return `${b ?? '?'} – ${d ?? ''}`.trim()
}

function info() {
  return {
    name: props.person?.name || props.doc.label,
    subtitle: props.person?.occupation || props.doc.label || '',
    lifespan: lifespan(),
    styleLabel: props.styleLabel,
    stars: props.stars,
    framing: framing.value,
    backdrop: backdrop.value,
    ...theme()
  }
}

function paint() {
  if (cardRef.value) paintCard(cardRef.value, props.doc, props.pack, info(), 2)
}

onMounted(paint)
watch([framing, backdrop], paint)

// ── Tilt + holo ───────────────────────────────────────────────────────────────
const rx = ref(0)
const ry = ref(0)
const mx = ref(50)
const my = ref(50)
const tiltStyle = computed(() => ({
  '--rx': rx.value + 'deg',
  '--ry': ry.value + 'deg',
  '--mx': mx.value + '%',
  '--my': my.value + '%'
}))

function onTilt(e) {
  const r = tiltRef.value.getBoundingClientRect()
  const px = (e.clientX - r.left) / r.width
  const py = (e.clientY - r.top) / r.height
  ry.value = (px - 0.5) * 22
  rx.value = (0.5 - py) * 18
  mx.value = px * 100
  my.value = py * 100
}

function resetTilt() {
  rx.value = 0
  ry.value = 0
  mx.value = 50
  my.value = 50
}

// ── Actions ───────────────────────────────────────────────────────────────────
function download() {
  const canvas = cardRef.value
  if (!canvas) return
  const a = document.createElement('a')
  a.download = `${(info().name || 'character').replace(/[^\w\- ]+/g, '').trim() || 'character'}-card.png`
  a.href = canvas.toDataURL('image/png')
  a.click()
}

function framedPortrait() {
  emit('set-framed', backdrop.value)
}

function onKey(e) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<style scoped>
.ps-overlay {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(5, 6, 12, 0.72);
  backdrop-filter: blur(6px);
  animation: ps-fade 0.25s ease both;
  overflow: hidden;
}

.ps-burst {
  position: absolute;
  width: 140vmax;
  height: 140vmax;
  background: repeating-conic-gradient(
    from 0deg,
    rgba(255, 255, 255, 0.07) 0deg 6deg,
    transparent 6deg 18deg
  );
  mask-image: radial-gradient(circle, #000 0%, transparent 55%);
  -webkit-mask-image: radial-gradient(circle, #000 0%, transparent 55%);
  animation: ps-spin 40s linear infinite;
  pointer-events: none;
}

.ps-body {
  position: relative;
  display: flex;
  align-items: center;
  gap: 32px;
  padding: 24px;
  max-height: 100%;
}

.ps-card {
  position: relative;
  height: min(80vh, 680px);
  aspect-ratio: 600 / 840;
  flex-shrink: 0;
  border-radius: 28px;
  transform: perspective(900px) rotateX(var(--rx)) rotateY(var(--ry));
  transition: transform 0.12s ease-out;
  box-shadow:
    0 30px 80px rgba(0, 0, 0, 0.55),
    0 0 0 1px rgba(255, 255, 255, 0.08);
  animation: ps-reveal 0.75s cubic-bezier(0.2, 0.9, 0.25, 1.15) both;
  overflow: hidden;
}

.ps-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.ps-holo {
  position: absolute;
  inset: 0;
  pointer-events: none;
  mix-blend-mode: color-dodge;
  opacity: 0.35;
  background: linear-gradient(
    115deg,
    transparent 20%,
    rgba(255, 120, 200, 0.55) calc(var(--mx) - 18%),
    rgba(120, 220, 255, 0.55) var(--mx),
    rgba(170, 255, 140, 0.5) calc(var(--mx) + 18%),
    transparent 80%
  );
  background-size: 200% 200%;
}

.ps-glare {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(
    circle at var(--mx) var(--my),
    rgba(255, 255, 255, 0.35),
    transparent 45%
  );
  mix-blend-mode: overlay;
}

.ps-controls {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 220px;
  animation: ps-fade 0.4s 0.25s ease both;
}

.ps-seg {
  display: inline-flex;
  padding: 3px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.ps-seg button {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: var(--ctl-sm);
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.75);
  padding: 0 12px;
  border-radius: 999px;
  font-family: var(--font);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}

.ps-seg button.on {
  background: var(--accent);
  color: #fff;
}

.ps-backdrops {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ps-bd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition:
    transform 0.15s,
    border-color 0.15s;
}

.ps-bd:hover {
  transform: translateY(-2px);
}

.ps-bd.on {
  border-color: var(--accent);
  background: var(--adim);
  color: #fff;
}

.ps-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

@keyframes ps-fade {
  from {
    opacity: 0;
  }
}

@keyframes ps-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes ps-reveal {
  0% {
    opacity: 0;
    transform: perspective(900px) rotateY(-100deg) scale(0.7);
  }
  60% {
    opacity: 1;
  }
  100% {
    transform: perspective(900px) rotateY(0) scale(1);
  }
}

@media (max-width: 760px) {
  .ps-body {
    flex-direction: column;
    gap: 16px;
  }
  .ps-card {
    height: min(58vh, 520px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ps-burst,
  .ps-card {
    animation: none;
  }
}
</style>
