<template>
  <div ref="rootRef" class="account">
    <button
      class="account-chip"
      :class="{ open }"
      :title="shownName"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click="toggle"
    >
      <span class="account-avatar" :style="avatarStyle">{{ initial }}</span>
      <span class="account-name">{{ shownName }}</span>
      <UiIcon class="account-caret" :class="{ flipped: open }" name="chevron-down" :size="14" />
    </button>

    <Transition name="acct-menu">
      <div v-if="open" class="account-menu ink-unroll">
        <div class="menu-head">
          <span class="account-avatar big" :style="avatarStyle">{{ initial }}</span>
          <div class="menu-head-text">
            <div class="menu-username">{{ shownName }}</div>
            <div class="menu-plan">
              <PlanBadge :plan="store.authUser.plan" />
            </div>
          </div>
        </div>

        <div v-if="store.authUsage" class="menu-usage">
          <div v-for="row in usageRows" :key="row.id" class="usage-row">
            <div class="usage-top">
              <span class="usage-label">{{ row.label }}</span>
              <span class="usage-count">{{ row.used }} / {{ row.max }}</span>
            </div>
            <div class="usage-track">
              <div
                class="usage-fill"
                :class="{ warn: row.ratio > 0.85 }"
                :style="{ width: Math.min(100, row.ratio * 100) + '%' }"
              ></div>
            </div>
          </div>
        </div>

        <button v-if="!store.isPaid && !store.isGuest" class="menu-upsell" @click="upgrade">
          <UiIcon class="menu-upsell-spark" name="sparkles" :size="18" />
          <span class="menu-upsell-text">
            <b>{{ t('billing.menu.title') }}</b>
            <span>{{ t('billing.menu.body') }}</span>
          </span>
          <UiIcon class="menu-upsell-arrow" name="arrow-right" :size="16" />
        </button>

        <div class="menu-sep"></div>
        <button v-if="!store.isGuest" class="menu-item" @click="openBilling">
          <UiIcon name="credit-card" :size="16" />
          {{ t('billing.menu.billing') }}
        </button>
        <button class="menu-item" @click="openProfile">
          <UiIcon name="user" :size="16" />
          {{ t('account.myProfile') }}
        </button>
        <button class="menu-item" @click="openLegal">
          <UiIcon name="file-text" :size="16" />
          {{ t('auth.termsPrivacy') }}
        </button>
        <button class="menu-item danger" @click="signOut">
          <UiIcon name="log-out" :size="16" />
          {{ t('account.security.signOut') }}
        </button>
      </div>
    </Transition>

    <LegalModal :open="legalOpen" @close="legalOpen = false" />
  </div>
</template>

<script setup>
import { userNameLabel } from '../lib/dataLabels'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useMainStore } from '../store/index.js'
import { useI18n } from '../i18n'
import { avatarStyleFor } from '../lib/avatar.js'
import LegalModal from './LegalModal.vue'
import PlanBadge from './billing/PlanBadge.vue'
import UiIcon from './ui/UiIcon.js'

const store = useMainStore()
const { t } = useI18n()
const open = ref(false)
const legalOpen = ref(false)
const rootRef = ref(null)

const shownName = computed(() => userNameLabel(store.authUser))
const initial = computed(() => (shownName.value[0] || '?').toUpperCase())
// Per-username hue, overridable from the profile page (lib/avatar.js)
const avatarStyle = computed(() => avatarStyleFor(store.authUser))

const usageRows = computed(() => {
  const u = store.authUsage
  if (!u) return []
  return [
    {
      id: 'people',
      label: t('account.usage.people'),
      used: u.persons,
      max: u.maxPersons,
      ratio: u.persons / u.maxPersons
    },
    {
      id: 'projects',
      label: t('account.usage.projects'),
      used: u.projects,
      max: u.maxProjects,
      ratio: u.projects / u.maxProjects
    },
    {
      id: 'photos',
      label: t('account.usage.photos'),
      used: u.images,
      max: u.maxImages,
      ratio: u.images / u.maxImages
    }
  ]
})

function toggle() {
  open.value = !open.value
  if (open.value) store.refreshUsage()
}

function openProfile() {
  open.value = false
  store.openUserPage()
}

function upgrade() {
  open.value = false
  store.openPricing({ reason: 'menu' })
}

// Plan & billing lives on the profile page; paid accounts land there, free
// ones go straight to the plans.
function openBilling() {
  open.value = false
  if (store.isPaid) store.openUserPage()
  else store.openPricing({ reason: 'menu' })
}

function openLegal() {
  open.value = false
  legalOpen.value = true
}

async function signOut() {
  open.value = false
  await store.logout()
}

function onDocClick(e) {
  if (open.value && rootRef.value && !rootRef.value.contains(e.target)) open.value = false
}

onMounted(() => document.addEventListener('mousedown', onDocClick))
onUnmounted(() => document.removeEventListener('mousedown', onDocClick))
</script>

<style scoped>
.account {
  position: relative;
}

.account-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: var(--ctl-md);
  padding: 0 9px 0 3px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--elevated);
  color: var(--t2);
  font-family: var(--font);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.account-chip:hover,
.account-chip.open {
  color: var(--t1);
  background: var(--hover);
  border-color: rgba(var(--accent-rgb), 0.4);
}

.account-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--on-accent);
  font-size: 12.5px;
  font-weight: 700;
  flex-shrink: 0;
}

.account-avatar.big {
  width: 38px;
  height: 38px;
  font-size: 17px;
}

.account-name {
  max-width: 110px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-caret {
  flex-shrink: 0;
  color: var(--t3);
  transition: transform 0.25s ease;
}

.account-caret.flipped {
  transform: rotate(180deg);
}

.account-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 240px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow);
  padding: 8px;
  z-index: 100;
  transform-origin: top right;
}

.menu-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 8px 10px;
}

.menu-head-text {
  min-width: 0;
}

.menu-username {
  color: var(--t1);
  font-size: 13.5px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.menu-plan {
  margin-top: 3px;
}

/* Upsell card: free accounts only */
.menu-upsell {
  display: flex;
  align-items: center;
  gap: 10px;
  width: calc(100% - 16px);
  margin: 4px 8px 6px;
  padding: 10px 12px;
  border: 1px solid rgba(var(--accent-rgb), 0.35);
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(var(--accent-rgb), 0.16), rgba(var(--accent-rgb), 0.04));
  color: var(--t1);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    transform 0.2s ease;
}

.menu-upsell:hover {
  border-color: rgba(var(--accent-rgb), 0.7);
  transform: translateY(-1px);
}

.menu-upsell-spark {
  flex-shrink: 0;
  color: var(--accent);
}

.menu-upsell-text {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  font-size: 12.5px;
  color: var(--t2);
}

.menu-upsell-text b {
  font-size: 13px;
  color: var(--t1);
}

.menu-upsell-arrow {
  flex-shrink: 0;
  color: var(--accent);
  transition: transform 0.2s ease;
}

.menu-upsell:hover .menu-upsell-arrow {
  transform: translateX(3px);
}

.menu-usage {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 8px 10px;
}

.usage-top {
  display: flex;
  justify-content: space-between;
  margin-bottom: 3px;
}

.usage-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--t2);
}

.usage-count {
  font-size: 12px;
  color: var(--t3);
  font-variant-numeric: tabular-nums;
}

.usage-track {
  height: 5px;
  border-radius: 3px;
  background: var(--elevated);
  overflow: hidden;
}

.usage-fill {
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, var(--accent), var(--accent-2));
  transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}

.usage-fill.warn {
  background: linear-gradient(90deg, var(--amber), var(--danger));
}

.menu-sep {
  height: 1px;
  background: var(--border);
  margin: 2px 6px 6px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  color: var(--t2);
  font-family: var(--font);
  font-size: 13px;
  font-weight: 500;
  padding: 8px 10px;
  border-radius: 9px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.menu-item:hover {
  background: var(--hover);
  color: var(--t1);
}

.menu-item .ui-icon {
  flex-shrink: 0;
  color: var(--t3);
}

.menu-item:hover .ui-icon {
  color: inherit;
}

.menu-item.danger:hover {
  background: rgba(var(--danger-rgb), 0.12);
  color: var(--danger);
}

.acct-menu-enter-active {
  transition:
    opacity 0.18s ease,
    transform 0.22s cubic-bezier(0.34, 1.3, 0.64, 1);
}

.acct-menu-leave-active {
  transition:
    opacity 0.14s ease,
    transform 0.14s ease;
}

.acct-menu-enter-from,
.acct-menu-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.96);
}

/* ── 水墨 ink theme: the avatar is a name seal (名章) in the user's colour ── */
:root[data-theme='ink'] .account-chip {
  border-radius: 3px 5px 4px 6px / 5px 3px 6px 4px;
  background: rgba(255, 251, 240, 0.5);
  font-family: var(--font-ink-label);
  font-size: 13px;
}
:root[data-theme='ink'] .account-avatar {
  border-radius: 3px 4px 2px 5px / 4px 2px 5px 3px;
  font-family: var(--font-brush);
  font-weight: 400;
  font-size: 14px;
  color: #fbf4e6;
  box-shadow:
    inset 0 0 0 1.5px rgba(251, 244, 230, 0.45),
    0 1px 2px rgba(60, 30, 10, 0.3);
  transform: rotate(-3deg);
}
:root[data-theme='ink'] .account-avatar.big {
  font-size: 22px;
}
:root[data-theme='ink'] .account-menu {
  background: var(--ink-sheet), var(--surface);
  background-size: 512px 512px;
  border-color: var(--ink-mount-line);
  border-radius: 2px;
  box-shadow:
    0 0 0 3px var(--ink-silk),
    0 0 0 4px rgba(58, 42, 22, 0.22),
    var(--shadow-lg);
}
:root[data-theme='ink'] .acct-menu-enter-from,
:root[data-theme='ink'] .acct-menu-leave-to {
  transform: none;
}
:root[data-theme='ink'] .menu-username {
  font-family: var(--font-brush);
  font-size: 19px;
  font-weight: 400;
}
:root[data-theme='ink'] .usage-label {
  font-family: var(--font-ink-label);
  font-variant: small-caps;
  text-transform: lowercase;
  letter-spacing: 0.08em;
}
:root[data-theme='ink'] .usage-track {
  border-radius: 1px;
  background: rgba(110, 88, 56, 0.12);
}
:root[data-theme='ink'] .usage-fill {
  border-radius: 1px;
  background: var(--ink-black);
  opacity: 0.75;
}
:root[data-theme='ink'] .usage-fill.warn {
  background: var(--accent);
  opacity: 1;
}
:root[data-theme='ink'] .menu-upsell {
  border-radius: 2px;
  font-family: var(--font-ink-label);
}
:root[data-theme='ink'] .menu-sep {
  height: 5px;
  background: rgba(28, 26, 23, 0.3);
  -webkit-mask: var(--ink-divider) center / 100% 100% no-repeat;
  mask: var(--ink-divider) center / 100% 100% no-repeat;
}
:root[data-theme='ink'] .menu-item {
  border-radius: 2px;
  font-family: var(--font-ink-label);
  font-size: 14px;
  background: radial-gradient(closest-side, rgba(40, 30, 18, 0.1), transparent) 30% 50% / 0% 0%
    no-repeat;
  transition:
    background-size 0.45s var(--ease-out),
    color var(--dur-fast);
}
:root[data-theme='ink'] .menu-item:hover {
  background-color: transparent;
  background-size: 170% 300%;
}
</style>
