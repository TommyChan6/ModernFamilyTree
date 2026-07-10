<template>
  <button
    class="pcard"
    :class="[`g-${person.gender || 'other'}`, { selected, 'pcard-enter': entering }]"
    :style="entering ? { '--i': stagger } : null"
    @click="$emit('select', person.id)"
  >
    <div class="pcard-sheen"></div>

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
      <div class="pcard-name" :title="person.name">{{ person.name }}</div>
      <div class="pcard-life">
        <template v-if="person.birth_year || person.death_year">
          {{ person.birth_year || '?'
          }}<span v-if="person.death_year"> – {{ person.death_year }}</span>
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
import { computed } from 'vue'
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
  width: var(--card-w, 196px);
  height: var(--card-h, 330px);
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
  transition:
    transform 0.28s cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 0.28s ease,
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
  transform: translateY(-8px);
  box-shadow:
    0 16px 34px rgba(0, 0, 0, 0.32),
    0 0 0 1px var(--accent-c);
  border-color: transparent;
}
.pcard.selected {
  border-color: var(--accent-c);
  box-shadow:
    0 0 0 2px var(--accent-c),
    0 12px 28px rgba(0, 0, 0, 0.3);
}

.pcard-sheen {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  background: linear-gradient(
    115deg,
    transparent 30%,
    rgba(255, 255, 255, 0.14) 48%,
    rgba(255, 255, 255, 0.05) 55%,
    transparent 70%
  );
  background-size: 250% 250%;
  background-position: 150% 150%;
  opacity: 0;
  transition: opacity 0.3s ease;
}
.pcard:hover .pcard-sheen {
  opacity: 1;
  animation: sheen-sweep 0.9s cubic-bezier(0.4, 0, 0.2, 1);
}
@keyframes sheen-sweep {
  from {
    background-position: 150% 150%;
  }
  to {
    background-position: -50% -50%;
  }
}

.pcard-banner {
  position: relative;
  height: 62px;
  width: 100%;
  align-self: stretch;
  flex-shrink: 0;
  background: linear-gradient(
    135deg,
    var(--accent-c),
    color-mix(in srgb, var(--accent-c) 55%, #1a1d2e)
  );
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 8px 10px;
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
  transform: scale(1.06);
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
.pcard-name {
  font-size: 14.5px;
  font-weight: 700;
  color: var(--t1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: -0.2px;
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
}
.pcard-stat-val {
  font-size: 13px;
  font-weight: 800;
  color: var(--accent-c);
  line-height: 1.1;
}
.pcard-stat-key {
  font-size: 8px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--t3);
}
</style>
