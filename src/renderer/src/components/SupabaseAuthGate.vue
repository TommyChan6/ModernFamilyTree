<!--
  Supabase sign-in gate (hosted web build).

  A minimal email + password screen with a Sign in / Sign up toggle, shown by
  App.vue whenever the app runs against the Supabase backend and no session
  exists. Styled entirely with the app's CSS design tokens, so it tracks the
  dark/light theme automatically. Sign-in success is handled by the store's
  auth-state listener (which loads data behind the welcome curtain), so this
  component only drives the form and surfaces errors.
-->
<template>
  <div class="auth-gate">
    <div class="auth-card">
      <button class="back-btn" type="button" @click="emit('back')">
        <UiIcon name="arrow-left" :size="14" />
        {{ t('auth.back') }}
      </button>
      <div class="brand">
        <UiIcon class="brand-mark" name="tree-deciduous" :size="22" />
        <span class="brand-name">Family Tree</span>
      </div>

      <h1 class="title">{{ isSignUp ? t('auth.sb.createTitle') : t('auth.sb.welcomeTitle') }}</h1>
      <p class="subtitle">
        {{ isSignUp ? t('auth.sb.createSub') : t('auth.sb.welcomeSub') }}
      </p>

      <!-- Sign-up confirmation notice (email confirmation is on) -->
      <div v-if="notice" class="notice">
        <UiIcon class="notice-icon" name="mail" :size="16" />
        <span>{{ notice }}</span>
      </div>

      <form v-else class="form" @submit.prevent="submit">
        <label class="field">
          <span class="field-label">{{ t('auth.email') }}</span>
          <input
            v-model.trim="email"
            type="email"
            autocomplete="email"
            :placeholder="t('auth.emailPh')"
            required
            :disabled="busy"
          />
        </label>

        <label class="field">
          <span class="field-label">{{ t('auth.password') }}</span>
          <input
            v-model="password"
            type="password"
            :autocomplete="isSignUp ? 'new-password' : 'current-password'"
            placeholder="••••••••"
            required
            minlength="6"
            :disabled="busy"
          />
        </label>

        <p v-if="error" class="error">{{ error }}</p>

        <button class="btn-primary" type="submit" :disabled="busy">
          {{ busy ? t('auth.sb.wait') : isSignUp ? t('auth.sb.signUp') : t('auth.signIn') }}
        </button>
      </form>

      <p class="toggle">
        {{ isSignUp ? t('auth.sb.haveAccount') : t('auth.sb.noAccount') }}
        <button class="toggle-btn" type="button" :disabled="busy" @click="toggleMode">
          {{ isSignUp ? t('auth.signIn') : t('auth.sb.signUp') }}
        </button>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useMainStore } from '../store/index.js'
import UiIcon from './ui/UiIcon.js'
import { useI18n } from '../i18n'

// Same contract as the native AuthGate: the homepage's CTAs pick the starting
// mode, and Back returns to the homepage.
const props = defineProps({ initialMode: { type: String, default: 'login' } })
const emit = defineEmits(['back'])

const store = useMainStore()
const { t } = useI18n()

const isSignUp = ref(props.initialMode === 'register')
const email = ref('')
const password = ref('')
const error = ref('')
const notice = ref('')
const busy = ref(false)

function toggleMode() {
  isSignUp.value = !isSignUp.value
  error.value = ''
  notice.value = ''
}

async function submit() {
  if (busy.value) return
  error.value = ''
  busy.value = true
  try {
    const res = isSignUp.value
      ? await store.signUp({ email: email.value, password: password.value })
      : await store.signIn({ email: email.value, password: password.value })

    if (!res.success) {
      error.value = res.error || t('auth.sb.genericError')
      return
    }
    // Sign-up may require email confirmation before a session exists.
    if (res.needsConfirmation) {
      notice.value = t('auth.sb.confirmSent', { email: email.value })
    }
    // Otherwise the store's auth listener takes over (loads data, hides this gate).
  } catch (e) {
    error.value = e?.message || String(e)
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
  display: grid;
  place-items: center;
  padding: 24px;
  background: radial-gradient(1200px 600px at 50% -10%, var(--adim), transparent 70%), var(--bg);
}

.auth-card {
  width: 100%;
  max-width: 380px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 32px 28px;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: transparent;
  color: var(--t3);
  font-family: var(--font);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  margin-bottom: 14px;
  transition: color 0.15s ease;
}

.back-btn:hover {
  color: var(--accent);
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
}

.brand-mark {
  flex-shrink: 0;
  color: var(--accent);
}

.brand-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--t1);
  letter-spacing: 0.2px;
}

.title {
  margin: 0 0 4px;
  font-size: 21px;
  font-weight: 700;
  color: var(--t1);
}

.subtitle {
  margin: 0 0 22px;
  font-size: 13px;
  color: var(--t2);
}

.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--t3);
}

.field input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--elevated);
  color: var(--t1);
  font-family: var(--font);
  font-size: 14px;
  outline: none;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.field input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--adim);
}

.field input:disabled {
  opacity: 0.6;
}

.error {
  margin: 0;
  padding: 8px 11px;
  border-radius: 8px;
  background: rgba(var(--danger-rgb), 0.12);
  border: 1px solid rgba(var(--danger-rgb), 0.35);
  color: var(--danger);
  font-size: 13px;
}

.notice {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 9px;
  background: var(--adim);
  border: 1px solid rgba(var(--accent-rgb), 0.35);
  color: var(--t1);
  font-size: 13px;
  line-height: 1.5;
}

.notice-icon {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--accent);
}

.btn-primary {
  margin-top: 4px;
  padding: 11px 14px;
  border: none;
  border-radius: 9px;
  background: var(--accent);
  color: var(--on-accent);
  font-family: var(--font);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition:
    filter 0.18s ease,
    transform 0.12s ease;
}

.btn-primary:hover:not(:disabled) {
  filter: brightness(1.08);
}

.btn-primary:active:not(:disabled) {
  transform: translateY(1px);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: default;
}

.toggle {
  margin: 20px 0 0;
  text-align: center;
  font-size: 13px;
  color: var(--t2);
}

.toggle-btn {
  border: none;
  background: transparent;
  color: var(--accent);
  font-family: var(--font);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  padding: 0 2px;
}

.toggle-btn:hover:not(:disabled) {
  text-decoration: underline;
}
</style>
