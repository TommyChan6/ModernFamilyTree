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
      <button class="back-btn" type="button" @click="emit('back')">← Back</button>
      <div class="brand">
        <span class="brand-mark">🌳</span>
        <span class="brand-name">Family Tree</span>
      </div>

      <h1 class="title">{{ isSignUp ? 'Create your account' : 'Welcome back' }}</h1>
      <p class="subtitle">
        {{ isSignUp ? 'Sign up to start building your trees.' : 'Sign in to your trees.' }}
      </p>

      <!-- Sign-up confirmation notice (email confirmation is on) -->
      <div v-if="notice" class="notice">✉️ {{ notice }}</div>

      <form v-else class="form" @submit.prevent="submit">
        <label class="field">
          <span class="field-label">Email</span>
          <input
            v-model.trim="email"
            type="email"
            autocomplete="email"
            placeholder="you@example.com"
            required
            :disabled="busy"
          />
        </label>

        <label class="field">
          <span class="field-label">Password</span>
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
          {{ busy ? 'Please wait…' : isSignUp ? 'Sign up' : 'Sign in' }}
        </button>
      </form>

      <p class="toggle">
        {{ isSignUp ? 'Already have an account?' : 'No account yet?' }}
        <button class="toggle-btn" type="button" :disabled="busy" @click="toggleMode">
          {{ isSignUp ? 'Sign in' : 'Sign up' }}
        </button>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useMainStore } from '../store/index.js'

// Same contract as the native AuthGate: the homepage's CTAs pick the starting
// mode, and Back returns to the homepage.
const props = defineProps({ initialMode: { type: String, default: 'login' } })
const emit = defineEmits(['back'])

const store = useMainStore()

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
      error.value = res.error || 'Something went wrong. Please try again.'
      return
    }
    // Sign-up may require email confirmation before a session exists.
    if (res.needsConfirmation) {
      notice.value = `We sent a confirmation link to ${email.value}. Confirm it, then sign in.`
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
  border: none;
  background: transparent;
  color: var(--t3);
  font-family: var(--font);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  padding: 0 0 14px;
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
  font-size: 22px;
  line-height: 1;
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
  font-size: 11px;
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
  background: rgba(239, 83, 80, 0.12);
  border: 1px solid rgba(239, 83, 80, 0.35);
  color: #ef5350;
  font-size: 12.5px;
}

.notice {
  padding: 12px 14px;
  border-radius: 9px;
  background: var(--adim);
  border: 1px solid rgba(108, 142, 245, 0.35);
  color: var(--t1);
  font-size: 13px;
  line-height: 1.5;
}

.btn-primary {
  margin-top: 4px;
  padding: 11px 14px;
  border: none;
  border-radius: 9px;
  background: var(--accent);
  color: #fff;
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
  font-size: 12.5px;
  color: var(--t2);
}

.toggle-btn {
  border: none;
  background: transparent;
  color: var(--accent);
  font-family: var(--font);
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  padding: 0 2px;
}

.toggle-btn:hover:not(:disabled) {
  text-decoration: underline;
}
</style>
