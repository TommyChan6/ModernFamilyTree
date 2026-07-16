<template>
  <button
    ref="cardEl"
    class="pcard"
    :class="[`g-${person.gender || 'other'}`, { selected, 'pcard-enter': entering }]"
    :style="cardStyle"
    @pointermove="onPointerMove"
    @pointerleave="onPointerLeave"
    @click="$emit('select', person.id)"
  >
    <!-- Hover ambience (all pointer-none, clipped to the card):
         · aura  — an accent wash that blooms up from the base
         · spot  — a soft light that tracks the cursor
         · edge  — a rotating conic accent that rims the card -->
    <div class="pcard-edge"></div>
    <div class="pcard-aura"></div>
    <div class="pcard-spot"></div>

    <!-- Banner -->
    <div class="pcard-banner">
      <span class="pcard-type">{{ genderLabel(person.gender) }}</span>
      <span v-if="age !== null" class="pcard-hp">
        {{ age }}<small>{{ deceased ? 'yr†' : 'yr' }}</small>
      </span>
    </div>

    <div class="pcard-avatar-wrap">
      <div class="pcard-avatar" :class="{ 'is-loading': showSkeleton }">
        <img
          v-if="avatarSrc"
          class="pcard-avatar-img"
          :src="avatarSrc"
          alt=""
          draggable="false"
          decoding="async"
        />
        <svg v-else-if="!hasPhoto" class="pcard-avatar-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path :d="PERSON_ICON_PATH" transform="translate(-5.28 -2.16) scale(1.44)" />
        </svg>
        <!-- else: a photo exists but its thumbnail is still resolving → skeleton -->
      </div>
    </div>

    <!-- Body -->
    <div class="pcard-body">
      <div class="pcard-name" :class="{ 'pcard-unnamed': !person.name }" :title="person.name">
        {{ person.name || 'Unnamed' }}
      </div>
      <div class="pcard-underline"></div>
      <div class="pcard-life">
        <template v-if="person.birth?.year || person.death?.year">
          {{ person.birth?.year || '?'
          }}<span v-if="person.death?.year"> – {{ person.death.year }}</span>
        </template>
        <span v-else class="pcard-dim">Dates unknown</span>
      </div>

      <div class="pcard-tags">
        <span v-if="person.occupation" class="pcard-tag">💼 {{ person.occupation }}</span>
        <span v-if="person.location" class="pcard-tag">📍 {{ person.location }}</span>
      </div>
    </div>

    <!-- Stats -->
    <div class="pcard-stats">
      <div class="pcard-stat">
        <span class="pcard-stat-val">{{ kin }}</span>
        <span class="pcard-stat-key">Relations</span>
      </div>
      <div class="pcard-stat">
        <span class="pcard-stat-val">{{ children }}</span>
        <span class="pcard-stat-key">Children</span>
      </div>
      <div class="pcard-stat">
        <span class="pcard-stat-val" style="text-transform: capitalize">{{
          person.gender || '—'
        }}</span>
        <span class="pcard-stat-key">Gender</span>
      </div>
    </div>
  </button>
</template>

<script setup>
import { computed, reactive, ref, onBeforeUnmount } from 'vue'
import { ageOf, isDeceased, genderLabel } from './peopleLayout.js'
import { useThumbnail } from './useThumbnail.js'

const PERSON_ICON_PATH =
  'M12 12.5c2.49 0 4.5-2.01 4.5-4.5S14.49 3.5 12 3.5 7.5 5.51 7.5 8s2.01 4.5 4.5 4.5zm0 2.25c-3 0-9 1.51-9 4.5V22h18v-2.75c0-2.99-6-4.5-9-4.5z'

const props = defineProps({
  person: { type: Object, required: true },
  selected: { type: Boolean, default: false },
  kin: { type: Number, default: 0 },
  children: { type: Number, default: 0 },
  refYear: { type: Number, required: true },
  // Entrance animation: driven by the view during the short window after a
  // search/sort change, so cards scrolled into view later just appear.
  entering: { type: Boolean, default: false },
  stagger: { type: Number, default: 0 }
})
defineEmits(['select'])

// ── Cursor-driven parallax tilt + spotlight ─────────────────────────────────
// Only the hovered card runs this (pointermove fires on one card at a time), and
// writes are coalesced to one per frame — cheap even with a full grid mounted.
const cardEl = ref(null)
// mx/my seed to the card centre so the first pre-move frame is neutral.
const fx = reactive({ rx: 0, ry: 0, mx: 105, my: 148 })
let moveRaf = 0
const reduceMotion =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
function onPointerMove(e) {
  const el = cardEl.value
  if (reduceMotion || !el || moveRaf) return
  const relX = e.clientX,
    relY = e.clientY
  moveRaf = requestAnimationFrame(() => {
    moveRaf = 0
    const r = el.getBoundingClientRect()
    const x = relX - r.left,
      y = relY - r.top
    fx.mx = x
    fx.my = y
    // Tilt toward the cursor; clamp the swing so it stays tasteful.
    fx.ry = (x / r.width - 0.5) * 15
    fx.rx = -(y / r.height - 0.5) * 15
  })
}
function onPointerLeave() {
  if (moveRaf) {
    cancelAnimationFrame(moveRaf)
    moveRaf = 0
  }
  fx.rx = 0
  fx.ry = 0
}
onBeforeUnmount(() => {
  if (moveRaf) cancelAnimationFrame(moveRaf)
})
const cardStyle = computed(() => {
  const s = {
    '--pc-rx': fx.rx + 'deg',
    '--pc-ry': fx.ry + 'deg',
    '--pc-mx': fx.mx + 'px',
    '--pc-my': fx.my + 'px'
  }
  if (props.entering) s['--i'] = props.stagger
  return s
})

const age = computed(() => ageOf(props.person, props.refYear))
const deceased = computed(() => isDeceased(props.person, props.refYear))
// Downscaled, cached avatar — never the full-resolution photo (see useThumbnail).
const { src: avatarSrc, loading: avatarLoading } = useThumbnail(
  () => props.person.primary_image || ''
)
const hasPhoto = computed(() => !!props.person.primary_image)
const showSkeleton = computed(() => hasPhoto.value && avatarLoading.value && !avatarSrc.value)
</script>

<style scoped>
@keyframes pcard-in {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.94);
  }
}
.pcard.pcard-enter {
  animation: pcard-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) backwards;
  animation-delay: calc(min(var(--i, 0), 24) * 0.028s);
}

.pcard {
  --accent-c: #5c6bc0;
  position: relative;
  width: var(--card-w, 210px);
  height: var(--card-h, 297px);
  /* Isolate each card's layout/style recalc from its siblings so mounting a new
     row while scrolling can't trigger work across the whole grid. (No `paint`
     containment — that would clip the card's drop shadow.) */
  contain: layout style;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 0 0 12px;
  cursor: pointer;
  overflow: hidden;
  font-family: var(--font);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
  /* One composed transform driven by CSS vars: lift + scale come from :hover,
     the rotateX/rotateY tilt is written per-frame from the cursor (see script).
     The short transition lets the tilt trail the cursor for a smooth, premium
     feel and eases the card back to rest on leave. */
  transform: perspective(760px) translate3d(0, var(--pc-lift, 0px), 0) rotateX(var(--pc-rx, 0deg))
    rotateY(var(--pc-ry, 0deg)) scale(var(--pc-sc, 1));
  transform-origin: center center;
  transition:
    transform 0.26s cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 0.3s ease,
    border-color 0.2s ease;
}
.pcard.g-male {
  --accent-c: #3a7bd5;
}
.pcard.g-female {
  --accent-c: #c95fa0;
}
.pcard.g-other {
  --accent-c: #5c6bc0;
}

.pcard:hover {
  --pc-lift: -10px;
  --pc-sc: 1.03;
  /* Promote only the hovered card so the per-frame cursor tilt stays smooth. */
  will-change: transform;
  box-shadow:
    0 22px 42px -12px rgba(0, 0, 0, 0.5),
    0 0 0 1px var(--accent-c),
    0 0 26px -4px color-mix(in srgb, var(--accent-c) 55%, transparent);
  border-color: transparent;
}
.pcard.selected {
  border-color: var(--accent-c);
  box-shadow:
    0 0 0 2px var(--accent-c),
    0 12px 28px rgba(0, 0, 0, 0.3);
}

/* ── Hover ambience layers ───────────────────────────────────────────────
   Each is pointer-none and clipped by the card's overflow:hidden. */

/* A glowing accent arc that travels around the card's rounded border. Drawn as
   a conic-gradient clipped to a 1.6px ring via the mask-exclude trick, then spun
   by animating the @property angle (degrades to a static rim where unsupported). */
@property --pc-angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}
.pcard-edge {
  position: absolute;
  inset: 0;
  z-index: 5; /* just the thin rim, above content but pointer-none */
  pointer-events: none;
  border-radius: 16px;
  padding: 1.6px;
  opacity: 0;
  background: conic-gradient(
    from var(--pc-angle),
    transparent 0deg,
    var(--accent-c) 60deg,
    transparent 130deg,
    transparent 220deg,
    color-mix(in srgb, var(--accent-c) 75%, #fff) 300deg,
    transparent 360deg
  );
  -webkit-mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  transition: opacity 0.4s ease;
}
.pcard:hover .pcard-edge {
  opacity: 1;
  animation: pcard-edge-spin 4s linear infinite;
}
@keyframes pcard-edge-spin {
  to {
    --pc-angle: 360deg;
  }
}

/* Accent wash blooming up from the base of the card. */
.pcard-aura {
  position: absolute;
  inset: 0;
  z-index: -1; /* above the surface + edge glow, still behind the content */
  pointer-events: none;
  opacity: 0;
  background: radial-gradient(
    120% 80% at 50% 118%,
    color-mix(in srgb, var(--accent-c) 42%, transparent),
    transparent 70%
  );
  transform: translateY(14px);
  transition:
    opacity 0.5s ease,
    transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}
.pcard:hover .pcard-aura {
  opacity: 1;
  transform: translateY(0);
}

/* A soft light that tracks the cursor (position from --pc-mx/--pc-my). Snaps to
   the pointer each frame via transform (no transition) so it never lags. */
.pcard-spot {
  position: absolute;
  top: 0;
  left: 0;
  width: 240px;
  height: 240px;
  margin: -120px 0 0 -120px;
  z-index: 4;
  pointer-events: none;
  border-radius: 50%;
  opacity: 0;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.14), transparent 62%);
  transform: translate(var(--pc-mx, 50%), var(--pc-my, 50%));
  transition: opacity 0.35s ease;
}
.pcard:hover .pcard-spot {
  opacity: 1;
}

.pcard-banner {
  position: relative;
  z-index: 0;
  height: 62px;
  width: 100%;
  align-self: stretch;
  flex-shrink: 0;
  /* Three-stop, oversized gradient so it can drift on hover for a living sheen. */
  background: linear-gradient(
    115deg,
    color-mix(in srgb, var(--accent-c) 55%, #1a1d2e),
    var(--accent-c),
    color-mix(in srgb, var(--accent-c) 60%, #1a1d2e)
  );
  background-size: 220% 220%;
  background-position: 0% 50%;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 8px 10px;
}
.pcard:hover .pcard-banner {
  animation: pcard-banner-drift 4.5s ease-in-out infinite;
}
@keyframes pcard-banner-drift {
  0%,
  100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}
/* Soft glow behind the avatar so the overlap reads as a deliberate nest */
.pcard-banner::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -14px;
  width: 96px;
  height: 60px;
  transform: translateX(-50%);
  background: radial-gradient(ellipse at center, rgba(255, 255, 255, 0.16), transparent 68%);
  pointer-events: none;
  transition: transform 0.3s ease;
}
.pcard:hover .pcard-banner::after {
  animation: pcard-glow-pulse 2.8s ease-in-out infinite;
}
@keyframes pcard-glow-pulse {
  0%,
  100% {
    transform: translateX(-50%) scale(1);
    opacity: 1;
  }
  50% {
    transform: translateX(-50%) scale(1.3);
    opacity: 0.7;
  }
}
.pcard-type {
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: #fff;
  background: rgba(0, 0, 0, 0.28);
  padding: 3px 8px;
  border-radius: 20px;
}
.pcard-hp {
  font-size: 14px;
  font-weight: 800;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  line-height: 1;
}
.pcard-hp small {
  font-size: 8.5px;
  font-weight: 700;
  opacity: 0.85;
  margin-left: 1px;
}

/* z-index lifts the avatar above the banner permanently — previously the banner
   (positioned) painted over it until hover created a stacking context */
.pcard-avatar-wrap {
  display: flex;
  justify-content: center;
  margin-top: -34px;
  position: relative;
  z-index: 1;
}
/* Colourful halo that fades in and slowly rotates behind the avatar on hover. */
.pcard-avatar-wrap::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 36px;
  width: 104px;
  height: 104px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: conic-gradient(
    from 0deg,
    var(--accent-c),
    transparent 32%,
    color-mix(in srgb, var(--accent-c) 75%, #fff) 58%,
    transparent 84%,
    var(--accent-c)
  );
  filter: blur(7px);
  opacity: 0;
  z-index: -1;
  pointer-events: none;
  transition: opacity 0.4s ease;
}
.pcard:hover .pcard-avatar-wrap::before {
  opacity: 0.8;
  animation: pcard-halo-spin 4s linear infinite;
}
@keyframes pcard-halo-spin {
  from {
    transform: translate(-50%, -50%) rotate(0deg);
  }
  to {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}
.pcard:hover .pcard-avatar-wrap {
  animation: pcard-float 2.6s ease-in-out infinite;
}
@keyframes pcard-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-5px);
  }
}
.pcard-avatar {
  position: relative;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  overflow: hidden;
  background: linear-gradient(
    135deg,
    var(--accent-c),
    color-mix(in srgb, var(--accent-c) 60%, #000)
  );
  border: 3px solid var(--surface);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.28);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s cubic-bezier(0.34, 1.4, 0.5, 1);
}
.pcard:hover .pcard-avatar {
  transform: scale(1.09);
  box-shadow:
    0 6px 18px rgba(0, 0, 0, 0.35),
    0 0 0 3px color-mix(in srgb, var(--accent-c) 35%, transparent);
}
.pcard-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  animation: pcard-avatar-in 0.35s ease both;
}
@keyframes pcard-avatar-in {
  from {
    opacity: 0;
  }
}

/* Skeleton shimmer while a photo's thumbnail is still resolving. Animates
   `transform` (compositor-only, no per-frame paint) rather than background
   position, so many simultaneous skeletons stay cheap. */
.pcard-avatar.is-loading::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: -60%;
  width: 60%;
  background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.22), transparent);
  animation: pcard-shimmer 1.15s ease-in-out infinite;
  will-change: transform;
}
@keyframes pcard-shimmer {
  to {
    transform: translateX(320%);
  }
}
@media (prefers-reduced-motion: reduce) {
  .pcard-avatar-img {
    animation: none;
  }
  .pcard-avatar.is-loading::after {
    animation: none;
  }
}
.pcard-avatar-icon {
  width: 46px;
  height: 46px;
  fill: rgba(255, 255, 255, 0.92);
}

.pcard-body {
  padding: 10px 14px 0;
  text-align: center;
  width: 100%;
}
.pcard-unnamed {
  color: var(--t3) !important;
  font-style: italic;
  font-weight: 500 !important;
}

.pcard-name {
  font-size: 14.5px;
  font-weight: 700;
  color: var(--t1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: -0.2px;
  transition:
    color 0.3s ease,
    letter-spacing 0.3s ease;
}
.pcard:hover .pcard-name {
  color: var(--accent-c);
  letter-spacing: 0.1px;
}
/* Accent underline that grows from the centre on hover (its own element so the
   name's overflow:hidden ellipsis clipping can't swallow it). */
.pcard-underline {
  height: 2px;
  width: 0;
  margin: 3px auto 0;
  border-radius: 2px;
  background: linear-gradient(90deg, transparent, var(--accent-c), transparent);
  transition: width 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}
.pcard:hover .pcard-underline {
  width: 70%;
}
.pcard-life {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--t2);
  margin-top: 2px;
}
.pcard-dim {
  color: var(--t3);
  font-weight: 500;
}

.pcard-tags {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  margin-top: 9px;
  min-height: 4px;
}
.pcard-tag {
  font-size: 10.5px;
  font-weight: 500;
  color: var(--t2);
  background: var(--elevated);
  border-radius: 6px;
  padding: 3px 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.pcard-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  width: calc(100% - 24px);
  margin: auto 0 0;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}
.pcard-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  transition: transform 0.42s cubic-bezier(0.22, 1, 0.36, 1);
}
/* Rise in sequence on hover for a lively little cascade. */
.pcard:hover .pcard-stat {
  transform: translateY(-3px);
}
.pcard:hover .pcard-stat:nth-child(1) {
  transition-delay: 0.03s;
}
.pcard:hover .pcard-stat:nth-child(2) {
  transition-delay: 0.08s;
}
.pcard:hover .pcard-stat:nth-child(3) {
  transition-delay: 0.13s;
}
.pcard-stat-val {
  font-size: 13px;
  font-weight: 800;
  color: var(--accent-c);
  line-height: 1.1;
  transition: text-shadow 0.3s ease;
}
.pcard:hover .pcard-stat-val {
  text-shadow: 0 0 12px color-mix(in srgb, var(--accent-c) 65%, transparent);
}
.pcard-stat-key {
  font-size: 8px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--t3);
}

/* Respect reduced-motion: keep the tasteful static hover cues (lift, colour,
   glow, underline) but silence every looping/parallax animation. The cursor
   tilt + spotlight are already skipped in script under this preference. */
@media (prefers-reduced-motion: reduce) {
  .pcard,
  .pcard-stat {
    transition:
      box-shadow 0.3s ease,
      border-color 0.2s ease,
      transform 0.2s ease;
  }
  .pcard:hover .pcard-edge,
  .pcard:hover .pcard-banner,
  .pcard:hover .pcard-banner::after,
  .pcard:hover .pcard-avatar-wrap,
  .pcard:hover .pcard-avatar-wrap::before {
    animation: none;
  }
}
</style>
