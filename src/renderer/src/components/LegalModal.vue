<template>
  <Teleport to="body">
    <Transition name="legal">
      <div v-if="open" class="legal-backdrop" @click.self="$emit('close')">
        <div class="legal-box" role="dialog" aria-modal="true">
          <header class="legal-head">
            <div class="legal-tabs">
              <button class="legal-tab" :class="{ active: tab === 'terms' }" @click="tab = 'terms'">
                Terms of Service
              </button>
              <button
                class="legal-tab"
                :class="{ active: tab === 'privacy' }"
                @click="tab = 'privacy'"
              >
                Privacy Policy
              </button>
            </div>
            <button class="legal-close" title="Close" @click="$emit('close')">×</button>
          </header>

          <div class="legal-body">
            <template v-if="tab === 'terms'">
              <h3>Terms of Service</h3>
              <p class="legal-updated">Last updated: July 2026</p>
              <p>
                Family Tree is a personal project for building and visualising family trees. By
                creating an account you agree to these terms.
              </p>
              <h4>Your account</h4>
              <p>
                You are responsible for keeping your password safe. Accounts are personal — please
                don't share credentials or impersonate others.
              </p>
              <h4>Your content</h4>
              <p>
                Everything you add (people, relationships, photos, notes) remains yours. You can
                export or delete your data at any time.
              </p>
              <h4>Fair use</h4>
              <p>
                Free accounts include a generous but limited amount of storage (people, projects and
                photos). Limits may change, and paid tiers with higher limits may be introduced
                later — existing data will never be deleted because of a limit change.
              </p>
              <h4>No warranty</h4>
              <p>
                The app is provided "as is", without warranty of any kind. Please keep your own
                backups of anything important.
              </p>
            </template>
            <template v-else>
              <h3>Privacy Policy</h3>
              <p class="legal-updated">Last updated: July 2026</p>
              <h4>Where your data lives</h4>
              <p>
                Right now, all data — your account, your trees and your photos — is stored
                <strong>locally on your device</strong> (a file on desktop, browser storage on the
                web). Nothing is sent to any server.
              </p>
              <h4>Your password</h4>
              <p>
                Passwords are never stored in plain text. They are hashed with a strong one-way
                algorithm (PBKDF2-SHA256) before being saved.
              </p>
              <h4>What we collect</h4>
              <p>
                Only what you enter: a username and the family data you create. No email, no
                tracking, no analytics, no third-party services.
              </p>
              <h4>The future hosted version</h4>
              <p>
                If this app becomes a hosted website, this policy will be updated before any data is
                stored online, and you will be asked to review it again.
              </p>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  initialTab: { type: String, default: 'terms' }
})
defineEmits(['close'])

const tab = ref(props.initialTab)
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) tab.value = props.initialTab
  }
)
</script>

<style scoped>
.legal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
}

.legal-box {
  width: min(560px, calc(100vw - 48px));
  max-height: min(640px, calc(100vh - 48px));
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow);
  overflow: hidden;
}

.legal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
}

.legal-tabs {
  display: flex;
  gap: 4px;
  background: var(--elevated);
  border-radius: 10px;
  padding: 3px;
}

.legal-tab {
  border: none;
  background: transparent;
  color: var(--t2);
  font-family: var(--font);
  font-size: 12px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.legal-tab.active {
  background: var(--surface);
  color: var(--t1);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
}

.legal-close {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--t3);
  font-size: 18px;
  cursor: pointer;
  transition: all 0.15s;
}

.legal-close:hover {
  background: var(--hover);
  color: var(--t1);
}

.legal-body {
  padding: 8px 20px 20px;
  overflow-y: auto;
  color: var(--t2);
  font-size: 13px;
  line-height: 1.65;
}

.legal-body h3 {
  color: var(--t1);
  font-size: 16px;
  margin: 12px 0 2px;
}

.legal-body h4 {
  color: var(--t1);
  font-size: 13px;
  margin: 14px 0 4px;
}

.legal-body p {
  margin: 4px 0;
}

.legal-updated {
  color: var(--t3);
  font-size: 11px;
}

.legal-enter-active,
.legal-leave-active {
  transition: opacity 0.22s ease;
}
.legal-enter-active .legal-box,
.legal-leave-active .legal-box {
  transition:
    transform 0.26s cubic-bezier(0.34, 1.3, 0.64, 1),
    opacity 0.22s ease;
}
.legal-enter-from,
.legal-leave-to {
  opacity: 0;
}
.legal-enter-from .legal-box,
.legal-leave-to .legal-box {
  transform: translateY(14px) scale(0.97);
  opacity: 0;
}
</style>
