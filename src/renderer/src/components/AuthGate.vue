<template>
  <div class="auth-gate">
    <!-- Ambient animated backdrop -->
    <div class="auth-bg">
      <div class="auth-blob blob-a"></div>
      <div class="auth-blob blob-b"></div>
      <div class="auth-blob blob-c"></div>
      <div class="auth-grid"></div>
    </div>

    <div class="auth-card" :class="{ shake: shaking }">
      <div class="auth-logo">
        <div class="auth-logo-mark">🌳</div>
        <h1 class="auth-title">Family Tree</h1>
        <p class="auth-subtitle">
          {{
            mode === 'login'
              ? 'Welcome back — sign in to continue'
              : 'Create an account to start your tree'
          }}
        </p>
      </div>

      <!-- Sign in / Create account segmented toggle -->
      <div class="auth-toggle" role="tablist">
        <div class="auth-toggle-pill" :class="{ right: mode === 'register' }"></div>
        <button
          class="auth-toggle-btn"
          :class="{ active: mode === 'login' }"
          type="button"
          @click="switchMode('login')"
        >
          Sign in
        </button>
        <button
          class="auth-toggle-btn"
          :class="{ active: mode === 'register' }"
          type="button"
          @click="switchMode('register')"
        >
          Create account
        </button>
      </div>

      <form class="auth-form" novalidate @submit.prevent="submit">
        <label class="auth-field">
          <input
            ref="usernameRef"
            v-model="username"
            class="auth-input"
            type="text"
            placeholder=" "
            autocomplete="username"
            spellcheck="false"
            maxlength="20"
          />
          <span class="auth-label">Username</span>
        </label>

        <label class="auth-field">
          <input
            v-model="password"
            class="auth-input"
            :type="showPassword ? 'text' : 'password'"
            placeholder=" "
            :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
          />
          <span class="auth-label">Password</span>
          <button
            type="button"
            class="auth-eye"
            :title="showPassword ? 'Hide password' : 'Show password'"
            tabindex="-1"
            @click="showPassword = !showPassword"
          >
            {{ showPassword ? '🙈' : '👁' }}
          </button>
        </label>

        <!-- Register-only fields slide open/closed -->
        <div class="auth-extra" :class="{ open: mode === 'register' }">
          <div class="auth-extra-inner">
            <div class="auth-strength" :class="{ visible: password.length > 0 }">
              <div class="strength-bars">
                <span
                  v-for="i in 3"
                  :key="i"
                  class="strength-bar"
                  :class="{ lit: strength >= i, ['level-' + strength]: strength >= i }"
                ></span>
              </div>
              <span class="strength-text">{{ strengthLabel }}</span>
            </div>

            <label class="auth-field">
              <input
                v-model="confirmPassword"
                class="auth-input"
                :type="showPassword ? 'text' : 'password'"
                placeholder=" "
                autocomplete="new-password"
              />
              <span class="auth-label">Confirm password</span>
            </label>

            <label class="auth-terms">
              <input v-model="acceptedTerms" type="checkbox" class="auth-check" />
              <span>
                I agree to the
                <button type="button" class="auth-link" @click="openLegal('terms')">Terms</button>
                and
                <button type="button" class="auth-link" @click="openLegal('privacy')">
                  Privacy Policy
                </button>
              </span>
            </label>
          </div>
        </div>

        <Transition name="auth-error">
          <p v-if="error" class="auth-error">{{ error }}</p>
        </Transition>

        <button class="auth-submit" type="submit" :disabled="busy">
          <span v-if="!busy">{{ mode === 'login' ? 'Sign in' : 'Create account' }}</span>
          <span v-else class="auth-spinner"></span>
        </button>
      </form>

      <p class="auth-foot">
        Your data stays on this device — see the
        <button type="button" class="auth-link" @click="openLegal('privacy')">
          Privacy Policy
        </button>
      </p>
    </div>

    <LegalModal :open="legalOpen" :initial-tab="legalTab" @close="legalOpen = false" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useMainStore } from '../store/index.js'
import { validateUsername, validatePassword } from '../../../shared/auth'
import LegalModal from './LegalModal.vue'

const store = useMainStore()

const mode = ref('login')
const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const acceptedTerms = ref(false)
const showPassword = ref(false)
const error = ref('')
const busy = ref(false)
const shaking = ref(false)
const legalOpen = ref(false)
const legalTab = ref('terms')
const usernameRef = ref(null)

onMounted(() => usernameRef.value?.focus())

function switchMode(next) {
  if (mode.value === next) return
  mode.value = next
  error.value = ''
}

function openLegal(tab) {
  legalTab.value = tab
  legalOpen.value = true
}

// 0–3: length 8+ gets you in the door, extra length and mixed character
// classes raise the score. Purely advisory — the shared validators decide.
const strength = computed(() => {
  const p = password.value
  if (p.length < 8) return 0
  let s = 1
  if (p.length >= 12) s++
  if (/[a-z]/.test(p) && /[A-Z]/.test(p) && /[0-9]/.test(p)) s++
  return Math.min(s, 3)
})
const strengthLabel = computed(() =>
  password.value.length === 0 ? '' : ['Too short', 'Okay', 'Good', 'Strong'][strength.value]
)

function fail(message) {
  error.value = message
  shaking.value = true
  setTimeout(() => (shaking.value = false), 450)
}

async function submit() {
  if (busy.value) return
  error.value = ''
  // Client-side pass over the same shared rules the data core enforces
  const usernameError = validateUsername(username.value)
  if (usernameError) return fail(usernameError)
  const passwordError = validatePassword(password.value)
  if (passwordError) return fail(passwordError)
  if (mode.value === 'register') {
    if (password.value !== confirmPassword.value) return fail('Passwords do not match')
    if (!acceptedTerms.value) return fail('Please accept the Terms & Privacy Policy')
  }

  busy.value = true
  try {
    const res =
      mode.value === 'login'
        ? await store.login({ username: username.value, password: password.value })
        : await store.register({
            username: username.value,
            password: password.value,
            acceptedTerms: acceptedTerms.value
          })
    if (!res.success) fail(res.error || 'Something went wrong')
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.auth-gate {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  overflow: hidden;
}

/* ── Ambient backdrop: drifting gradient blobs over a faint dot grid ────── */
.auth-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.auth-blob {
  position: absolute;
  width: 55vmax;
  height: 55vmax;
  border-radius: 50%;
  filter: blur(90px);
  opacity: 0.32;
  will-change: transform;
}

.blob-a {
  background: radial-gradient(circle, var(--accent) 0%, transparent 62%);
  top: -20vmax;
  left: -12vmax;
  animation: blob-drift-a 26s ease-in-out infinite alternate;
}

.blob-b {
  background: radial-gradient(circle, var(--pink) 0%, transparent 62%);
  bottom: -24vmax;
  right: -14vmax;
  opacity: 0.2;
  animation: blob-drift-b 32s ease-in-out infinite alternate;
}

.blob-c {
  background: radial-gradient(circle, var(--green) 0%, transparent 62%);
  bottom: -18vmax;
  left: 24vw;
  width: 38vmax;
  height: 38vmax;
  opacity: 0.14;
  animation: blob-drift-c 38s ease-in-out infinite alternate;
}

@keyframes blob-drift-a {
  to {
    transform: translate(9vmax, 7vmax) scale(1.12);
  }
}
@keyframes blob-drift-b {
  to {
    transform: translate(-8vmax, -6vmax) scale(1.08);
  }
}
@keyframes blob-drift-c {
  to {
    transform: translate(6vmax, -5vmax) scale(1.15);
  }
}

.auth-grid {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(
    color-mix(in srgb, var(--t3) 34%, transparent) 1px,
    transparent 1px
  );
  background-size: 26px 26px;
  mask-image: radial-gradient(ellipse at center, black 0%, transparent 72%);
}

/* ── The card ─────────────────────────────────────────────────────────────── */
.auth-card {
  position: relative;
  width: min(400px, calc(100vw - 40px));
  padding: 34px 34px 24px;
  background: var(--glass-strong);
  backdrop-filter: blur(18px);
  border: 1px solid var(--border);
  border-radius: 20px;
  box-shadow: var(--shadow);
  animation: card-in 0.55s cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes card-in {
  from {
    opacity: 0;
    transform: translateY(22px) scale(0.97);
  }
}

.auth-card.shake {
  animation: card-shake 0.4s ease;
}

@keyframes card-shake {
  20% {
    transform: translateX(-9px);
  }
  40% {
    transform: translateX(8px);
  }
  60% {
    transform: translateX(-5px);
  }
  80% {
    transform: translateX(4px);
  }
}

.auth-logo {
  text-align: center;
  margin-bottom: 22px;
}

.auth-logo-mark {
  width: 58px;
  height: 58px;
  margin: 0 auto 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  border-radius: 18px;
  background: linear-gradient(135deg, var(--adim), rgba(108, 142, 245, 0.32));
  border: 1px solid rgba(108, 142, 245, 0.35);
  box-shadow: 0 6px 22px rgba(108, 142, 245, 0.22);
  animation: logo-float 5s ease-in-out infinite;
}

@keyframes logo-float {
  50% {
    transform: translateY(-5px);
  }
}

.auth-title {
  font-size: 21px;
  font-weight: 700;
  color: var(--t1);
  letter-spacing: 0.2px;
  margin: 0;
}

.auth-subtitle {
  font-size: 12.5px;
  color: var(--t2);
  margin: 5px 0 0;
}

/* ── Mode toggle with sliding pill ────────────────────────────────────────── */
.auth-toggle {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  background: var(--elevated);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 3px;
  margin-bottom: 20px;
}

.auth-toggle-pill {
  position: absolute;
  top: 3px;
  bottom: 3px;
  left: 3px;
  width: calc(50% - 3px);
  border-radius: 9px;
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
  transition: transform 0.32s cubic-bezier(0.34, 1.2, 0.64, 1);
}

.auth-toggle-pill.right {
  transform: translateX(100%);
}

.auth-toggle-btn {
  position: relative;
  z-index: 1;
  border: none;
  background: transparent;
  color: var(--t3);
  font-family: var(--font);
  font-size: 13px;
  font-weight: 600;
  padding: 8px 0;
  border-radius: 9px;
  cursor: pointer;
  transition: color 0.25s ease;
}

.auth-toggle-btn.active {
  color: var(--t1);
}

/* ── Fields with floating labels ──────────────────────────────────────────── */
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.auth-field {
  position: relative;
  display: block;
}

.auth-input {
  width: 100%;
  padding: 20px 40px 7px 13px;
  background: var(--elevated);
  border: 1px solid var(--border);
  border-radius: 11px;
  color: var(--t1);
  font-family: var(--font);
  font-size: 13.5px;
  outline: none;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.auth-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--adim);
}

/* Edge injects its own reveal eye on password inputs — we provide our own */
.auth-input::-ms-reveal {
  display: none;
}

.auth-label {
  position: absolute;
  left: 13px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--t3);
  font-size: 13px;
  pointer-events: none;
  transition: all 0.18s cubic-bezier(0.22, 1, 0.36, 1);
}

.auth-input:focus + .auth-label,
.auth-input:not(:placeholder-shown) + .auth-label {
  top: 12px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--accent);
}

.auth-eye {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  font-size: 14px;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 7px;
  opacity: 0.55;
  transition: opacity 0.15s;
}

.auth-eye:hover {
  opacity: 1;
}

/* ── Register-only section slides open (grid-rows trick) ─────────────────── */
.auth-extra {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.38s cubic-bezier(0.22, 1, 0.36, 1);
}

.auth-extra.open {
  grid-template-rows: 1fr;
}

.auth-extra-inner {
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
  opacity: 0;
  transform: translateY(-6px);
  transition:
    opacity 0.28s ease,
    transform 0.32s ease;
}

.auth-extra.open .auth-extra-inner {
  opacity: 1;
  transform: translateY(0);
  /* breathing room so the focus ring isn't clipped by overflow:hidden */
  padding: 4px 2px;
  margin: -4px -2px;
}

/* ── Password strength ────────────────────────────────────────────────────── */
.auth-strength {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 0;
  opacity: 0;
  overflow: hidden;
  transition: all 0.25s ease;
}

.auth-strength.visible {
  height: 14px;
  opacity: 1;
}

.strength-bars {
  display: flex;
  gap: 4px;
  flex: 1;
}

.strength-bar {
  height: 4px;
  flex: 1;
  border-radius: 2px;
  background: var(--elevated);
  transition: background 0.3s ease;
}

.strength-bar.lit.level-1 {
  background: var(--amber);
}
.strength-bar.lit.level-2 {
  background: color-mix(in srgb, var(--amber) 40%, var(--green));
}
.strength-bar.lit.level-3 {
  background: var(--green);
}

.strength-text {
  font-size: 10.5px;
  font-weight: 600;
  color: var(--t3);
  min-width: 52px;
  text-align: right;
}

/* ── Terms checkbox ───────────────────────────────────────────────────────── */
.auth-terms {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  font-size: 12px;
  color: var(--t2);
  line-height: 1.5;
  cursor: pointer;
}

.auth-check {
  margin-top: 2px;
  width: 15px;
  height: 15px;
  accent-color: var(--accent);
  cursor: pointer;
  flex-shrink: 0;
}

.auth-link {
  border: none;
  background: none;
  padding: 0;
  font: inherit;
  font-weight: 600;
  color: var(--accent);
  cursor: pointer;
  text-decoration: none;
}

.auth-link:hover {
  text-decoration: underline;
}

/* ── Error + submit ───────────────────────────────────────────────────────── */
.auth-error {
  margin: -2px 0;
  font-size: 12px;
  font-weight: 500;
  color: #ef5350;
  text-align: center;
}

.auth-error-enter-active,
.auth-error-leave-active {
  transition: all 0.2s ease;
}

.auth-error-enter-from,
.auth-error-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.auth-submit {
  position: relative;
  border: none;
  border-radius: 11px;
  padding: 12px;
  margin-top: 2px;
  background: linear-gradient(135deg, var(--accent), #8b6cc5);
  color: #fff;
  font-family: var(--font);
  font-size: 13.5px;
  font-weight: 700;
  letter-spacing: 0.3px;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    box-shadow 0.25s ease,
    filter 0.2s ease;
}

.auth-submit:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 24px rgba(108, 142, 245, 0.35);
  filter: brightness(1.06);
}

.auth-submit:active:not(:disabled) {
  transform: translateY(0);
}

.auth-submit:disabled {
  cursor: default;
  filter: saturate(0.7) brightness(0.9);
}

.auth-spinner {
  display: inline-block;
  width: 15px;
  height: 15px;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  vertical-align: -3px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.auth-foot {
  margin: 18px 0 0;
  text-align: center;
  font-size: 11px;
  color: var(--t3);
}
</style>
