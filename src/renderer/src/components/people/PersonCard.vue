<template>
  <button
    ref="cardEl"
    class="pcard"
    :class="[
      'st-' + cardStyle,
      `g-${person.gender || 'other'}`,
      { selected, 'pcard-enter': entering, dead: deceased }
    ]"
    :style="fxStyle"
    @pointermove="onPointerMove"
    @pointerleave="onPointerLeave"
    @click="$emit('select', person.id)"
  >
    <!-- Shared hover ambience (pointer-none, clipped by the card):
         · edge — a rotating conic accent that rims the card
         · spot — a soft light that tracks the cursor -->
    <div class="pcard-edge"></div>
    <div class="pcard-spot"></div>

    <!-- ═══════════════ Classic — the original directory card ═══════════════ -->
    <template v-if="cardStyle === 'classic'">
      <div class="pcard-aura"></div>

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
          <svg
            v-else-if="!hasPhoto"
            class="pcard-avatar-icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path :d="PERSON_ICON_PATH" transform="translate(-5.28 -2.16) scale(1.44)" />
          </svg>
        </div>
      </div>

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
    </template>

    <!-- ═══════ Full Art — the photo IS the card, info floats in front ═══════ -->
    <template v-else-if="cardStyle === 'poster'">
      <div class="po-bg">
        <img v-if="avatarSrc" class="po-img" :src="avatarSrc" alt="" draggable="false" />
        <div v-else class="po-fallback">
          <span class="po-mono">{{ initials }}</span>
        </div>
        <div class="po-scrim"></div>
      </div>

      <div class="po-top">
        <span class="po-chip po-glyph">{{ genderGlyph }}</span>
        <span v-if="deceased" class="po-chip">🕊</span>
        <span v-if="age !== null" class="po-chip po-age">{{ age }} yr</span>
      </div>

      <div class="po-info">
        <div v-if="person.occupation" class="po-kicker">{{ person.occupation }}</div>
        <div class="po-name" :class="{ 'po-unnamed': !person.name }">
          {{ person.name || 'Unnamed' }}
        </div>
        <div class="po-rule"></div>
        <div class="po-meta">
          {{ lifeText }}<span v-if="person.location"> · {{ person.location }}</span>
        </div>
        <div class="po-foot">
          <span class="po-stat">🔗 {{ kin }}</span>
          <span class="po-stat">✦ {{ children }}</span>
          <span v-for="t in tagPills" :key="t.id" class="po-tag" :style="{ '--tc': t.color }">
            {{ t.label }}
          </span>
        </div>
      </div>
    </template>

    <!-- ═══════════ Holo — trading-card foil, HP, attacks, rarity ═══════════ -->
    <template v-else-if="cardStyle === 'holo'">
      <div class="ho-inner">
        <div class="ho-head">
          <span class="ho-stage">{{ deceased ? 'LEGEND' : 'BASIC' }}</span>
          <span class="ho-name" :title="person.name">{{ person.name || 'Unnamed' }}</span>
          <span class="ho-hp"><i>HP</i>{{ hp }}</span>
        </div>

        <div class="ho-art">
          <img v-if="avatarSrc" class="ho-img" :src="avatarSrc" alt="" draggable="false" />
          <div v-else class="ho-fallback">
            <span>{{ initials }}</span>
          </div>
          <div class="ho-rays"></div>
        </div>

        <div class="ho-type">
          <span class="ho-type-orb">{{ genderGlyph }}</span>
          {{ typeLabel }} · {{ lifeText }}
        </div>

        <div class="ho-attack">
          <span class="ho-orb">🔗</span>
          <span class="ho-atk">
            <b>Kinship</b>
            <small>Draws strength from every bond.</small>
          </span>
          <span class="ho-dmg">{{ kin * 10 }}</span>
        </div>
        <div class="ho-attack">
          <span class="ho-orb">✦</span>
          <span class="ho-atk">
            <b>Legacy</b>
            <small>Passes the story to the next age.</small>
          </span>
          <span class="ho-dmg">{{ children * 10 }}</span>
        </div>

        <div class="ho-foot">
          <span class="ho-stars"><i v-for="n in stars" :key="n">★</i></span>
          <span class="ho-set">№ {{ person.birth?.year || '???' }} · {{ refYear }}</span>
        </div>
      </div>
      <div class="ho-gloss"></div>
    </template>

    <!-- ═════════════ Neon — cyberpunk dossier, scanlines, glitch ═════════════ -->
    <template v-else-if="cardStyle === 'neon'">
      <div class="ne-grid"></div>
      <div class="ne-scan"></div>
      <div class="ne-corners"></div>

      <div class="ne-head">
        <span class="ne-id">ID://{{ shortId }}</span>
        <span class="ne-status" :class="deceased ? 'ne-off' : 'ne-on'">
          <i class="ne-dot"></i>{{ deceased ? 'ARCHIVED' : 'ONLINE' }}
        </span>
      </div>

      <div class="ne-avatar-wrap">
        <div class="ne-ring"></div>
        <div class="ne-avatar">
          <img v-if="avatarSrc" :src="avatarSrc" alt="" draggable="false" />
          <span v-else>{{ initials }}</span>
        </div>
      </div>

      <div class="ne-name" :data-text="person.name || 'UNNAMED'">
        {{ person.name || 'UNNAMED' }}
      </div>

      <div class="ne-rows">
        <div class="ne-row">
          <span>AGE</span><i></i><b>{{ age ?? '——' }}</b>
        </div>
        <div class="ne-row">
          <span>LINKS</span><i></i><b>{{ kin }}</b>
        </div>
        <div class="ne-row">
          <span>HEIRS</span><i></i><b>{{ children }}</b>
        </div>
        <div class="ne-row">
          <span>ORIGIN</span><i></i><b class="ne-clip">{{ person.location || 'UNKNOWN' }}</b>
        </div>
      </div>

      <div class="ne-bars"></div>
    </template>

    <!-- ══════════════ Arcana — tarot card, gold frame, starfield ══════════════ -->
    <template v-else-if="cardStyle === 'arcana'">
      <div class="ar-stars"></div>
      <div class="ar-frame"></div>
      <div class="ar-numeral">{{ numeral }}</div>

      <div class="ar-arch">
        <img v-if="avatarSrc" class="ar-img" :src="avatarSrc" alt="" draggable="false" />
        <div v-else class="ar-fallback">
          <span>{{ initials }}</span>
        </div>
        <div class="ar-arch-glow"></div>
      </div>

      <div class="ar-name" :title="person.name">{{ person.name || 'Unnamed' }}</div>
      <div class="ar-role">{{ person.occupation || genderLabel(person.gender) }}</div>

      <div class="ar-divider"><span>✦</span></div>

      <div class="ar-years">{{ lifeText }}</div>
      <div class="ar-glyph">{{ deceased ? '☾' : '☀' }}</div>
    </template>
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
  /** The person's tags ([{ id, label, color }]) — full-art shows the first two. */
  tags: { type: Array, default: () => [] },
  /** Which card face to render: classic | poster | holo | neon | arcana. */
  cardStyle: { type: String, default: 'classic' },
  // Entrance animation: driven by the view during the short window after a
  // search/sort/style change, so cards scrolled into view later just appear.
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
const fxStyle = computed(() => {
  const s = {
    '--pc-rx': fx.rx + 'deg',
    '--pc-ry': fx.ry + 'deg',
    '--pc-mx': fx.mx + 'px',
    '--pc-my': fx.my + 'px'
  }
  if (props.entering) s['--i'] = props.stagger
  return s
})

// ── Shared card data ────────────────────────────────────────────────────────
const age = computed(() => ageOf(props.person, props.refYear))
const deceased = computed(() => isDeceased(props.person, props.refYear))
const hasPhoto = computed(() => !!props.person.primary_image)

// Downscaled, cached art — bigger for the styles that paint it large.
const ART_SIZES = { poster: 384, holo: 384, arcana: 288 }
const { src: avatarSrc, loading: avatarLoading } = useThumbnail(
  () => props.person.primary_image || '',
  () => ART_SIZES[props.cardStyle] || 144
)
const showSkeleton = computed(() => hasPhoto.value && avatarLoading.value && !avatarSrc.value)

const initials = computed(() => {
  const parts = (props.person.name || '?').trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (parts[0] || '?').substring(0, 2).toUpperCase()
})

const genderGlyph = computed(() =>
  props.person.gender === 'male' ? '♂' : props.person.gender === 'female' ? '♀' : '●'
)

const lifeText = computed(() => {
  const b = props.person.birth?.year
  const d = props.person.death?.year
  if (b && d) return `${b} – ${d}`
  if (b) return `b. ${b}`
  if (d) return `d. ${d}`
  return 'Dates unknown'
})

const tagPills = computed(() =>
  (props.tags || []).slice(0, 2).map((t) => ({
    id: t.id,
    label: (t.icon ? t.icon + ' ' : '') + t.label,
    color: t.color || 'var(--accent)'
  }))
)

// ── Holo (TCG) flavour ──────────────────────────────────────────────────────
const hp = computed(() => Math.min(240, 60 + props.kin * 20))
const stars = computed(() => Math.max(1, Math.min(5, 1 + Math.floor(props.kin / 2))))
const typeLabel = computed(
  () => props.tags?.[0]?.label || genderLabel(props.person.gender).replace(/^\S+\s/, '')
)

// ── Neon flavour ────────────────────────────────────────────────────────────
const shortId = computed(() => (props.person.id || '').replace(/-/g, '').slice(0, 8).toUpperCase())

// ── Arcana flavour ──────────────────────────────────────────────────────────
function roman(n) {
  if (!Number.isFinite(n) || n <= 0 || n > 3999) return '✶'
  const table = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I']
  ]
  let out = ''
  for (const [v, s] of table) {
    while (n >= v) {
      out += s
      n -= v
    }
  }
  return out
}
const numeral = computed(() => roman(age.value ?? props.kin))
</script>

<style scoped>
/* ════════════════════════════ Shared shell ════════════════════════════════ */
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

/* ── Per-style deal-in animations ──────────────────────────────────────────
   Each face enters with its own signature motion, staggered by --i. */
.pcard.pcard-enter {
  animation: pcard-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) backwards;
  animation-delay: calc(min(var(--i, 0), 24) * 0.028s);
}
@keyframes pcard-in {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.94);
  }
}
.pcard.st-poster.pcard-enter {
  animation-name: pcard-in-poster;
  animation-duration: 0.55s;
}
@keyframes pcard-in-poster {
  from {
    opacity: 0;
    transform: scale(1.12);
    filter: blur(8px);
  }
}
.pcard.st-holo.pcard-enter {
  animation-name: pcard-in-holo;
  animation-duration: 0.6s;
}
@keyframes pcard-in-holo {
  from {
    opacity: 0;
    transform: perspective(760px) rotateY(75deg) translateY(10px);
  }
}
.pcard.st-neon.pcard-enter {
  animation-name: pcard-in-neon;
  animation-duration: 0.5s;
  animation-timing-function: ease-out;
}
@keyframes pcard-in-neon {
  0% {
    opacity: 0;
    transform: translateY(14px);
  }
  55% {
    opacity: 1;
  }
  65% {
    opacity: 0.35;
  }
  75% {
    opacity: 1;
  }
  85% {
    opacity: 0.6;
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}
.pcard.st-arcana.pcard-enter {
  animation-name: pcard-in-arcana;
  animation-duration: 0.6s;
}
@keyframes pcard-in-arcana {
  from {
    opacity: 0;
    transform: rotate(-6deg) translateY(22px) scale(0.92);
  }
}

/* ── Shared hover ambience layers ──────────────────────────────────────────
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
  z-index: 6; /* just the thin rim, above content but pointer-none */
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

/* Accent wash blooming up from the base of the card (classic only). */
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
  z-index: 5;
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

/* ════════════════════════════ Classic face ════════════════════════════════ */
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

/* ════════════════════════════ Full Art face ═══════════════════════════════ */
.st-poster {
  padding: 0;
  justify-content: flex-end;
  background: #12141d;
}

.po-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  border-radius: inherit;
}
.po-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(1.02);
  transition:
    transform 0.6s cubic-bezier(0.22, 1, 0.36, 1),
    filter 0.4s ease;
}
.st-poster:hover .po-img {
  transform: scale(1.09);
}
.st-poster.dead .po-img {
  filter: grayscale(0.5) sepia(0.12);
}
.po-fallback {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(
    120% 100% at 20% 0%,
    color-mix(in srgb, var(--accent-c) 55%, #0c0e16),
    #0c0e16
  );
}
.po-mono {
  font-size: 92px;
  font-weight: 900;
  letter-spacing: -0.02em;
  color: color-mix(in srgb, var(--accent-c) 55%, #fff);
  opacity: 0.28;
  transition:
    opacity 0.4s ease,
    transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}
.st-poster:hover .po-mono {
  opacity: 0.45;
  transform: scale(1.08);
}
/* Cinematic scrim so the floating info always reads. Deepens on hover. */
.po-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(6, 8, 14, 0.12) 0%,
    transparent 32%,
    rgba(6, 8, 14, 0.16) 55%,
    rgba(6, 8, 14, 0.85) 100%
  );
  transition: opacity 0.35s ease;
}
.st-poster:hover .po-scrim {
  opacity: 0.92;
}

.po-top {
  position: absolute;
  top: 10px;
  left: 10px;
  right: 10px;
  z-index: 2;
  display: flex;
  gap: 5px;
}
.po-chip {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 14px;
  background: rgba(8, 10, 16, 0.55);
  backdrop-filter: blur(5px);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: rgba(255, 255, 255, 0.92);
  font-size: 10px;
  font-weight: 700;
}
.po-age {
  margin-left: auto;
}
.po-glyph {
  color: color-mix(in srgb, var(--accent-c) 70%, #fff);
}

.po-info {
  position: relative;
  z-index: 2;
  width: 100%;
  padding: 0 14px 13px;
  text-align: left;
  transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}
.st-poster:hover .po-info {
  transform: translateY(-4px);
}
.po-kicker {
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 1.4px;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--accent-c) 75%, #fff);
  margin-bottom: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.po-name {
  font-size: 19px;
  font-weight: 800;
  line-height: 1.12;
  letter-spacing: -0.3px;
  color: #fff;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.55);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.po-unnamed {
  color: rgba(255, 255, 255, 0.55);
  font-style: italic;
}
.po-rule {
  height: 2px;
  width: 30px;
  margin: 6px 0;
  border-radius: 2px;
  background: linear-gradient(90deg, var(--accent-c), transparent);
  transition: width 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}
.st-poster:hover .po-rule {
  width: 78px;
}
.po-meta {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.75);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.po-foot {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 9px;
  overflow: hidden;
}
.po-stat {
  font-size: 10px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.85);
  background: rgba(8, 10, 16, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 2px 8px;
  flex-shrink: 0;
}
.po-tag {
  font-size: 9.5px;
  font-weight: 700;
  color: #fff;
  background: color-mix(in srgb, var(--tc, var(--accent-c)) 40%, rgba(8, 10, 16, 0.5));
  border: 1px solid color-mix(in srgb, var(--tc, var(--accent-c)) 55%, transparent);
  border-radius: 12px;
  padding: 2px 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ═════════════════════════════ Holo face ══════════════════════════════════ */
/* Gold-foil trading card: metallic frame, art window, attack rows, rarity. */
.st-holo {
  padding: 7px;
  background: linear-gradient(145deg, #f4d97c, #b8913a 28%, #f8e6a0 50%, #a8842f 74%, #e8c96a);
  background-size: 220% 220%;
  background-position: 30% 30%;
  border: none;
  transition:
    transform 0.26s cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 0.3s ease,
    background-position 0.5s ease;
}
.st-holo:hover {
  background-position: 70% 70%;
}
.ho-inner {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  border-radius: 10px;
  background: var(--surface);
  overflow: hidden;
  padding: 7px 8px 6px;
}

.ho-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 1px 5px;
}
.ho-stage {
  font-size: 7.5px;
  font-weight: 800;
  letter-spacing: 0.5px;
  color: var(--t3);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 1px 4px;
  flex-shrink: 0;
}
.ho-name {
  font-size: 13px;
  font-weight: 800;
  color: var(--t1);
  letter-spacing: -0.2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
  flex: 1;
}
.ho-hp {
  font-size: 14px;
  font-weight: 900;
  color: #e0483e;
  flex-shrink: 0;
  line-height: 1;
}
.ho-hp i {
  font-style: normal;
  font-size: 8px;
  font-weight: 800;
  margin-right: 2px;
  vertical-align: 2px;
}

.ho-art {
  position: relative;
  height: 118px;
  flex-shrink: 0;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, #b8913a 55%, var(--border));
  background: radial-gradient(
    130% 110% at 50% 0%,
    color-mix(in srgb, var(--accent-c) 60%, #101322),
    #101322
  );
}
.ho-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}
.st-holo:hover .ho-img {
  transform: scale(1.08);
}
.ho-fallback {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 44px;
  font-weight: 900;
  color: color-mix(in srgb, var(--accent-c) 60%, #fff);
  opacity: 0.75;
  text-shadow: 0 0 26px color-mix(in srgb, var(--accent-c) 80%, transparent);
}
/* Radiating "energy" behind the subject — spins up on hover. */
.ho-rays {
  position: absolute;
  inset: -40%;
  background: conic-gradient(
    from 0deg,
    transparent 0deg,
    color-mix(in srgb, var(--accent-c) 30%, transparent) 14deg,
    transparent 28deg,
    transparent 40deg,
    color-mix(in srgb, var(--accent-c) 22%, transparent) 55deg,
    transparent 70deg,
    transparent 90deg,
    color-mix(in srgb, var(--accent-c) 30%, transparent) 104deg,
    transparent 118deg,
    transparent 160deg,
    color-mix(in srgb, var(--accent-c) 26%, transparent) 175deg,
    transparent 190deg,
    transparent 230deg,
    color-mix(in srgb, var(--accent-c) 30%, transparent) 245deg,
    transparent 260deg,
    transparent 300deg,
    color-mix(in srgb, var(--accent-c) 24%, transparent) 315deg,
    transparent 330deg
  );
  opacity: 0.4;
  mix-blend-mode: screen;
  pointer-events: none;
}
.st-holo:hover .ho-rays {
  animation: ho-rays-spin 14s linear infinite;
}
@keyframes ho-rays-spin {
  to {
    transform: rotate(360deg);
  }
}

.ho-type {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  margin: 5px 0;
  padding: 3px 8px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--accent-c) 14%, var(--elevated));
  border: 1px solid color-mix(in srgb, var(--accent-c) 30%, transparent);
  font-size: 9.5px;
  font-weight: 700;
  color: var(--t1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ho-type-orb {
  color: color-mix(in srgb, var(--accent-c) 80%, var(--t1));
  font-weight: 800;
}

.ho-attack {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 4px;
  border-top: 1px solid var(--border);
  text-align: left;
}
.ho-orb {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--accent-c) 22%, var(--elevated));
  border: 1px solid color-mix(in srgb, var(--accent-c) 40%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  flex-shrink: 0;
  transition: transform 0.3s cubic-bezier(0.34, 1.4, 0.5, 1);
}
.st-holo:hover .ho-orb {
  transform: scale(1.12) rotate(-8deg);
}
.ho-atk {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}
.ho-atk b {
  font-size: 11px;
  font-weight: 800;
  color: var(--t1);
}
.ho-atk small {
  font-size: 8.5px;
  color: var(--t3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ho-dmg {
  font-size: 15px;
  font-weight: 900;
  color: var(--t1);
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  transition:
    color 0.3s ease,
    text-shadow 0.3s ease;
}
.st-holo:hover .ho-dmg {
  color: var(--accent-c);
  text-shadow: 0 0 12px color-mix(in srgb, var(--accent-c) 60%, transparent);
}

.ho-foot {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 2px 0;
  border-top: 1px solid var(--border);
}
.ho-stars {
  display: inline-flex;
  gap: 1px;
  color: #d9a93c;
  font-size: 10px;
  text-shadow: 0 0 6px rgba(217, 169, 60, 0.6);
}
.ho-stars i {
  font-style: normal;
  transition: transform 0.3s cubic-bezier(0.34, 1.5, 0.5, 1);
}
.st-holo:hover .ho-stars i {
  transform: scale(1.25) rotate(12deg);
}
.st-holo:hover .ho-stars i:nth-child(1) {
  transition-delay: 0s;
}
.st-holo:hover .ho-stars i:nth-child(2) {
  transition-delay: 0.05s;
}
.st-holo:hover .ho-stars i:nth-child(3) {
  transition-delay: 0.1s;
}
.st-holo:hover .ho-stars i:nth-child(4) {
  transition-delay: 0.15s;
}
.st-holo:hover .ho-stars i:nth-child(5) {
  transition-delay: 0.2s;
}
.ho-set {
  font-size: 8px;
  font-weight: 700;
  color: var(--t3);
  letter-spacing: 0.4px;
}

/* The foil: a rainbow sheen across the whole card that lives at the cursor.
   Hidden until hover so idle grids cost nothing. */
.ho-gloss {
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  border-radius: inherit;
  opacity: 0;
  background:
    radial-gradient(
      340px circle at var(--pc-mx, 50%) var(--pc-my, 40%),
      rgba(255, 255, 255, 0.28),
      transparent 46%
    ),
    linear-gradient(
      115deg,
      rgba(255, 0, 132, 0.18) 8%,
      rgba(252, 164, 0, 0.14) 26%,
      rgba(255, 255, 0, 0.1) 40%,
      rgba(0, 255, 138, 0.14) 58%,
      rgba(0, 207, 255, 0.18) 76%,
      rgba(204, 76, 250, 0.18) 92%
    );
  mix-blend-mode: color-dodge;
  transition: opacity 0.35s ease;
}
.st-holo:hover .ho-gloss {
  opacity: 1;
}

/* ═════════════════════════════ Neon face ══════════════════════════════════ */
/* Cyberpunk dossier: always-dark, neon rim, scanlines, glitch name. */
.st-neon {
  background: #090d13;
  border: 1px solid color-mix(in srgb, var(--accent-c) 55%, transparent);
  border-radius: 10px;
  padding: 12px 12px 10px;
  box-shadow:
    0 2px 10px rgba(0, 0, 0, 0.4),
    inset 0 0 30px -18px color-mix(in srgb, var(--accent-c) 80%, transparent);
}
.st-neon:hover {
  box-shadow:
    0 22px 42px -12px rgba(0, 0, 0, 0.6),
    0 0 0 1px var(--accent-c),
    0 0 30px -2px color-mix(in srgb, var(--accent-c) 60%, transparent),
    inset 0 0 34px -16px color-mix(in srgb, var(--accent-c) 90%, transparent);
}
.st-neon .pcard-edge {
  border-radius: 10px;
}
/* Static scanline texture (one paint, no animation while idle). */
.ne-grid {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    180deg,
    transparent 0 2px,
    color-mix(in srgb, var(--accent-c) 4%, transparent) 2px 3px
  );
  opacity: 0.8;
}
/* A scan bar that sweeps down on hover. */
.ne-scan {
  position: absolute;
  left: 0;
  right: 0;
  top: -12%;
  height: 12%;
  z-index: 1;
  pointer-events: none;
  background: linear-gradient(
    180deg,
    transparent,
    color-mix(in srgb, var(--accent-c) 22%, transparent),
    transparent
  );
  opacity: 0;
}
.st-neon:hover .ne-scan {
  opacity: 1;
  animation: ne-scan-sweep 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
@keyframes ne-scan-sweep {
  to {
    transform: translateY(950%);
  }
}
/* Corner brackets, drawn with 8 tiny gradients. */
.ne-corners {
  position: absolute;
  inset: 5px;
  z-index: 1;
  pointer-events: none;
  --nc: color-mix(in srgb, var(--accent-c) 85%, #fff);
  background:
    linear-gradient(var(--nc), var(--nc)) 0 0 / 12px 1.5px,
    linear-gradient(var(--nc), var(--nc)) 0 0 / 1.5px 12px,
    linear-gradient(var(--nc), var(--nc)) 100% 0 / 12px 1.5px,
    linear-gradient(var(--nc), var(--nc)) 100% 0 / 1.5px 12px,
    linear-gradient(var(--nc), var(--nc)) 0 100% / 12px 1.5px,
    linear-gradient(var(--nc), var(--nc)) 0 100% / 1.5px 12px,
    linear-gradient(var(--nc), var(--nc)) 100% 100% / 12px 1.5px,
    linear-gradient(var(--nc), var(--nc)) 100% 100% / 1.5px 12px;
  background-repeat: no-repeat;
  transition: inset 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}
.st-neon:hover .ne-corners {
  inset: 2px;
}

.ne-head {
  position: relative;
  z-index: 2;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-family: Consolas, 'Courier New', monospace;
}
.ne-id {
  font-size: 9px;
  color: color-mix(in srgb, var(--accent-c) 70%, #9aa);
  letter-spacing: 0.5px;
}
.ne-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 8.5px;
  font-weight: 700;
  letter-spacing: 0.8px;
}
.ne-status.ne-on {
  color: #37e08b;
}
.ne-status.ne-off {
  color: #7d8496;
}
.ne-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.ne-on .ne-dot {
  box-shadow: 0 0 8px currentColor;
  animation: ne-blink 1.6s ease-in-out infinite;
}
@keyframes ne-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}

.ne-avatar-wrap {
  position: relative;
  z-index: 2;
  margin-top: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ne-ring {
  position: absolute;
  width: 96px;
  height: 96px;
  border-radius: 50%;
  border: 1.5px dashed color-mix(in srgb, var(--accent-c) 55%, transparent);
}
.st-neon:hover .ne-ring {
  animation: ne-ring-spin 9s linear infinite;
}
@keyframes ne-ring-spin {
  to {
    transform: rotate(360deg);
  }
}
.ne-avatar {
  width: 78px;
  height: 78px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--accent-c) 20%, #0b0f16);
  border: 2px solid color-mix(in srgb, var(--accent-c) 70%, transparent);
  box-shadow: 0 0 22px -4px color-mix(in srgb, var(--accent-c) 65%, transparent);
  color: color-mix(in srgb, var(--accent-c) 65%, #fff);
  font-family: Consolas, 'Courier New', monospace;
  font-size: 22px;
  font-weight: 700;
  transition: transform 0.3s cubic-bezier(0.34, 1.4, 0.5, 1);
}
.st-neon:hover .ne-avatar {
  transform: scale(1.07);
}
.ne-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.st-neon.dead .ne-avatar img {
  filter: grayscale(0.7);
}

.ne-name {
  position: relative;
  z-index: 2;
  margin-top: 12px;
  max-width: 100%;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: #e8f2ff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 0 14px color-mix(in srgb, var(--accent-c) 55%, transparent);
}
/* RGB-split glitch on hover: two clipped copies jitter behind the name. */
.ne-name::before,
.ne-name::after {
  content: attr(data-text);
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  opacity: 0;
  pointer-events: none;
}
.st-neon:hover .ne-name::before {
  opacity: 0.75;
  color: #ff2d6d;
  clip-path: inset(0 0 55% 0);
  animation: ne-glitch-a 1.1s steps(2, end) infinite;
}
.st-neon:hover .ne-name::after {
  opacity: 0.75;
  color: #29d8ff;
  clip-path: inset(55% 0 0 0);
  animation: ne-glitch-b 1.3s steps(2, end) infinite;
}
@keyframes ne-glitch-a {
  0%,
  84%,
  100% {
    transform: translateX(0);
  }
  88% {
    transform: translateX(-3px);
  }
  94% {
    transform: translateX(2px);
  }
}
@keyframes ne-glitch-b {
  0%,
  80%,
  100% {
    transform: translateX(0);
  }
  86% {
    transform: translateX(3px);
  }
  92% {
    transform: translateX(-2px);
  }
}

.ne-rows {
  position: relative;
  z-index: 2;
  width: 100%;
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-family: Consolas, 'Courier New', monospace;
}
.ne-row {
  display: flex;
  align-items: baseline;
  gap: 7px;
  font-size: 10px;
}
.ne-row span {
  color: color-mix(in srgb, var(--accent-c) 55%, #8892a8);
  letter-spacing: 1px;
  flex-shrink: 0;
}
.ne-row i {
  flex: 1;
  border-bottom: 1px dotted color-mix(in srgb, var(--accent-c) 30%, transparent);
  transform: translateY(-2px);
}
.ne-row b {
  color: #dfe9ff;
  font-weight: 700;
  font-size: 11px;
  flex-shrink: 0;
}
.ne-clip {
  max-width: 90px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Barcode footer. */
.ne-bars {
  position: relative;
  z-index: 2;
  margin-top: auto;
  width: 100%;
  height: 14px;
  background: repeating-linear-gradient(
    90deg,
    color-mix(in srgb, var(--accent-c) 55%, transparent) 0 2px,
    transparent 2px 5px,
    color-mix(in srgb, var(--accent-c) 40%, transparent) 5px 6px,
    transparent 6px 10px
  );
  opacity: 0.5;
  transition: opacity 0.3s ease;
}
.st-neon:hover .ne-bars {
  opacity: 0.9;
}

/* ════════════════════════════ Arcana face ═════════════════════════════════ */
/* Tarot: midnight velvet, gilded double frame, arched portrait, celestial glyphs. */
.st-arcana {
  --accent-c: #d4af37;
  background: radial-gradient(130% 100% at 50% 0%, #241a44 0%, #140e2b 55%, #0d0920 100%);
  border: 1px solid rgba(212, 175, 55, 0.4);
  border-radius: 12px;
  padding: 18px 12px 12px;
  font-family: Georgia, 'Times New Roman', serif;
}
.st-arcana:hover {
  box-shadow:
    0 22px 42px -12px rgba(0, 0, 0, 0.6),
    0 0 0 1px rgba(212, 175, 55, 0.8),
    0 0 30px -2px rgba(212, 175, 55, 0.35);
}
/* Star specks — two layered dot fields; the upper one twinkles on hover. */
.ar-stars {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-image:
    radial-gradient(1px 1px at 18% 22%, rgba(255, 255, 255, 0.7), transparent 100%),
    radial-gradient(1px 1px at 72% 14%, rgba(255, 255, 255, 0.5), transparent 100%),
    radial-gradient(1.5px 1.5px at 86% 38%, rgba(255, 255, 255, 0.6), transparent 100%),
    radial-gradient(1px 1px at 8% 56%, rgba(255, 255, 255, 0.45), transparent 100%),
    radial-gradient(1px 1px at 30% 84%, rgba(255, 255, 255, 0.5), transparent 100%),
    radial-gradient(1.5px 1.5px at 62% 72%, rgba(255, 255, 255, 0.55), transparent 100%),
    radial-gradient(1px 1px at 92% 88%, rgba(255, 255, 255, 0.45), transparent 100%),
    radial-gradient(1px 1px at 46% 8%, rgba(255, 255, 255, 0.6), transparent 100%);
}
.st-arcana:hover .ar-stars {
  animation: ar-twinkle 2.6s ease-in-out infinite;
}
@keyframes ar-twinkle {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
}
/* Gilded inner frame with a second hairline. */
.ar-frame {
  position: absolute;
  inset: 7px;
  z-index: 1;
  pointer-events: none;
  border: 1px solid rgba(212, 175, 55, 0.55);
  border-radius: 8px;
  box-shadow: inset 0 0 0 3px rgba(212, 175, 55, 0.12);
  transition: box-shadow 0.35s ease;
}
.st-arcana:hover .ar-frame {
  box-shadow:
    inset 0 0 0 3px rgba(212, 175, 55, 0.22),
    inset 0 0 22px -8px rgba(212, 175, 55, 0.4);
}

.ar-numeral {
  position: relative;
  z-index: 2;
  font-size: 13px;
  letter-spacing: 4px;
  color: #d4af37;
  text-shadow: 0 0 10px rgba(212, 175, 55, 0.5);
}

.ar-arch {
  position: relative;
  z-index: 2;
  width: 122px;
  height: 138px;
  margin-top: 9px;
  border-radius: 61px 61px 8px 8px;
  overflow: hidden;
  border: 1.5px solid rgba(212, 175, 55, 0.7);
  background: radial-gradient(110% 100% at 50% 0%, #3a2b6b, #1a1338);
  box-shadow: 0 6px 20px -6px rgba(0, 0, 0, 0.6);
  transition:
    transform 0.35s cubic-bezier(0.34, 1.3, 0.5, 1),
    box-shadow 0.35s ease;
}
.st-arcana:hover .ar-arch {
  transform: translateY(-3px);
  box-shadow:
    0 12px 26px -8px rgba(0, 0, 0, 0.7),
    0 0 24px -4px rgba(212, 175, 55, 0.45);
}
.ar-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: saturate(0.9) contrast(1.04);
  transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}
.st-arcana:hover .ar-img {
  transform: scale(1.07);
}
.st-arcana.dead .ar-img {
  filter: grayscale(0.6) sepia(0.25);
}
.ar-fallback {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  color: rgba(212, 175, 55, 0.8);
  text-shadow: 0 0 22px rgba(212, 175, 55, 0.5);
}
/* Candlelight bloom rising inside the arch on hover. */
.ar-arch-glow {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(90% 55% at 50% 108%, rgba(212, 175, 55, 0.4), transparent 70%);
  opacity: 0;
  transition: opacity 0.45s ease;
}
.st-arcana:hover .ar-arch-glow {
  opacity: 1;
}

.ar-name {
  position: relative;
  z-index: 2;
  margin-top: 12px;
  max-width: 100%;
  padding: 0 8px;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.4px;
  color: #efe4c3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.6);
  transition:
    text-shadow 0.35s ease,
    color 0.35s ease;
}
.st-arcana:hover .ar-name {
  color: #f8ecc8;
  text-shadow: 0 0 16px rgba(212, 175, 55, 0.55);
}
.ar-role {
  position: relative;
  z-index: 2;
  margin-top: 2px;
  font-size: 11px;
  font-style: italic;
  color: rgba(220, 208, 175, 0.65);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 88%;
}

.ar-divider {
  position: relative;
  z-index: 2;
  width: 70%;
  margin: 9px 0 7px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #d4af37;
  font-size: 9px;
}
.ar-divider::before,
.ar-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.55));
}
.ar-divider::after {
  background: linear-gradient(90deg, rgba(212, 175, 55, 0.55), transparent);
}
.ar-divider span {
  transition: transform 0.5s cubic-bezier(0.34, 1.4, 0.5, 1);
}
.st-arcana:hover .ar-divider span {
  transform: rotate(180deg) scale(1.25);
}

.ar-years {
  position: relative;
  z-index: 2;
  font-size: 12px;
  letter-spacing: 1.6px;
  color: rgba(233, 222, 190, 0.85);
  font-variant-numeric: tabular-nums;
}
.ar-glyph {
  position: relative;
  z-index: 2;
  margin-top: auto;
  font-size: 15px;
  color: #d4af37;
  text-shadow: 0 0 12px rgba(212, 175, 55, 0.6);
  transition: transform 0.5s cubic-bezier(0.34, 1.4, 0.5, 1);
}
.st-arcana:hover .ar-glyph {
  transform: scale(1.2) rotate(-12deg);
}

/* ═══════════════════════ Reduced motion ═══════════════════════════════════ */
/* Keep the tasteful static hover cues (lift, colour, glow) but silence every
   looping/parallax animation. The cursor tilt + spotlight are already skipped
   in script under this preference. */
@media (prefers-reduced-motion: reduce) {
  .pcard,
  .pcard-stat {
    transition:
      box-shadow 0.3s ease,
      border-color 0.2s ease,
      transform 0.2s ease;
  }
  .pcard.pcard-enter,
  .pcard-avatar-img,
  .pcard-avatar.is-loading::after,
  .pcard:hover .pcard-edge,
  .pcard:hover .pcard-banner,
  .pcard:hover .pcard-banner::after,
  .pcard:hover .pcard-avatar-wrap,
  .pcard:hover .pcard-avatar-wrap::before,
  .st-holo:hover .ho-rays,
  .st-neon:hover .ne-scan,
  .st-neon:hover .ne-ring,
  .st-neon:hover .ne-name::before,
  .st-neon:hover .ne-name::after,
  .ne-on .ne-dot,
  .st-arcana:hover .ar-stars {
    animation: none;
  }
}
</style>
