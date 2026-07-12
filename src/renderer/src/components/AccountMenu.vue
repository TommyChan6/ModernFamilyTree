<template>
  <div ref="rootRef" class="account">
    <button class="account-chip" :class="{ open }" :title="store.authUser.username" @click="toggle">
      <span class="account-avatar" :style="avatarStyle">{{ initial }}</span>
      <span class="account-name">{{ shownName }}</span>
      <span class="account-caret" :class="{ flipped: open }">▾</span>
    </button>

    <Transition name="acct-menu">
      <div v-if="open" class="account-menu">
        <div class="menu-head">
          <span class="account-avatar big" :style="avatarStyle">{{ initial }}</span>
          <div class="menu-head-text">
            <div class="menu-username">{{ shownName }}</div>
            <div class="menu-plan">
              <span class="plan-badge">{{ planLabel }}</span>
            </div>
          </div>
        </div>

        <div v-if="store.authUsage" class="menu-usage">
          <div v-for="row in usageRows" :key="row.label" class="usage-row">
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

        <div class="menu-sep"></div>
        <button class="menu-item" @click="openProfile">👤 {{ t('account.myProfile') }}</button>
        <button class="menu-item" @click="openLegal">📄 Terms &amp; Privacy</button>
        <button class="menu-item danger" @click="signOut">↩ Sign out</button>
      </div>
    </Transition>

    <LegalModal :open="legalOpen" @close="legalOpen = false" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useMainStore } from '../store/index.js'
import { useI18n } from '../i18n'
import { avatarStyleFor } from '../lib/avatar.js'
import LegalModal from './LegalModal.vue'

const store = useMainStore()
const { t } = useI18n()
const open = ref(false)
const legalOpen = ref(false)
const rootRef = ref(null)

const shownName = computed(() => store.authUser?.display_name || store.authUser?.username || '')
const initial = computed(() => (shownName.value[0] || '?').toUpperCase())
const planLabel = computed(() => {
  const plan = store.authUser?.plan
  if (plan === 'free') return 'Free plan'
  if (plan === 'guest') return 'Guest'
  return plan
})

// Per-username hue, overridable from the profile page (lib/avatar.js)
const avatarStyle = computed(() => avatarStyleFor(store.authUser))

const usageRows = computed(() => {
  const u = store.authUsage
  if (!u) return []
  return [
    { label: 'People', used: u.persons, max: u.maxPersons, ratio: u.persons / u.maxPersons },
    { label: 'Projects', used: u.projects, max: u.maxProjects, ratio: u.projects / u.maxProjects },
    { label: 'Photos', used: u.images, max: u.maxImages, ratio: u.images / u.maxImages }
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
  padding: 4px 9px 4px 4px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--elevated);
  color: var(--t2);
  font-family: var(--font);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.account-chip:hover,
.account-chip.open {
  color: var(--t1);
  background: var(--hover);
  border-color: rgba(108, 142, 245, 0.4);
}

.account-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 12px;
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
  font-size: 9px;
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

.plan-badge {
  display: inline-block;
  margin-top: 3px;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--adim);
  border: 1px solid rgba(108, 142, 245, 0.35);
  color: var(--accent);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.4px;
  text-transform: uppercase;
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
  font-size: 11px;
  font-weight: 600;
  color: var(--t2);
}

.usage-count {
  font-size: 10.5px;
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
  background: linear-gradient(90deg, var(--accent), #8b6cc5);
  transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}

.usage-fill.warn {
  background: linear-gradient(90deg, var(--amber), #ef5350);
}

.menu-sep {
  height: 1px;
  background: var(--border);
  margin: 2px 6px 6px;
}

.menu-item {
  display: block;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  color: var(--t2);
  font-family: var(--font);
  font-size: 12.5px;
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

.menu-item.danger:hover {
  background: rgba(239, 83, 80, 0.12);
  color: #ef5350;
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
</style>
