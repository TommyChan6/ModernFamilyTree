<template>
  <Teleport to="body">
    <Transition name="settings-modal">
      <div v-if="store.appSettingsOpen" class="sm-backdrop" @click.self="close">
        <div class="sm-box" role="dialog" aria-modal="true" aria-label="Settings">
          <!-- Sidebar tabs -->
          <nav class="sm-nav">
            <div class="sm-nav-title">{{ t('settings.title') }}</div>
            <button
              v-for="tab in tabs"
              :key="tab.id"
              class="sm-nav-item"
              :class="{ active: active === tab.id }"
              @click="active = tab.id"
            >
              <span class="sm-nav-icon">{{ tab.icon }}</span>
              <span>{{ t(tab.labelKey) }}</span>
            </button>
          </nav>

          <div class="sm-panel">
            <button class="sm-close" :title="t('settings.close')" @click="close">×</button>

            <!-- ── General ─────────────────────────────────────────────── -->
            <section v-if="active === 'general'" class="sm-section">
              <div class="sm-field">
                <div class="sm-field-head">
                  <span class="sm-field-icon">🌐</span>
                  <div>
                    <div class="sm-field-title">{{ t('settings.language.title') }}</div>
                    <p class="sm-field-desc">{{ t('settings.language.desc') }}</p>
                  </div>
                </div>
                <div class="sm-lang-grid">
                  <button
                    v-for="loc in SUPPORTED_LOCALES"
                    :key="loc.code"
                    class="sm-lang"
                    :class="{ active: store.language === loc.code }"
                    @click="store.setLanguage(loc.code)"
                  >
                    <span class="sm-lang-native">{{ loc.native }}</span>
                    <span class="sm-lang-label">{{ loc.label }}</span>
                    <span v-if="store.language === loc.code" class="sm-lang-check">✓</span>
                  </button>
                </div>
              </div>

              <div class="sm-field">
                <div class="sm-field-head">
                  <span class="sm-field-icon">🎨</span>
                  <div>
                    <div class="sm-field-title">{{ t('settings.theme.title') }}</div>
                    <p class="sm-field-desc">{{ t('settings.theme.desc') }}</p>
                  </div>
                </div>
                <div class="sm-segment">
                  <button
                    class="sm-seg-btn"
                    :class="{ active: store.theme === 'light' }"
                    @click="store.setTheme('light')"
                  >
                    ☀ {{ t('settings.theme.light') }}
                  </button>
                  <button
                    class="sm-seg-btn"
                    :class="{ active: store.theme === 'dark' }"
                    @click="store.setTheme('dark')"
                  >
                    🌙 {{ t('settings.theme.dark') }}
                  </button>
                </div>
              </div>

              <div class="sm-field">
                <div class="sm-field-head">
                  <span class="sm-field-icon">🏷️</span>
                  <div>
                    <div class="sm-field-title">{{ t('settings.noun.title') }}</div>
                    <p class="sm-field-desc">{{ t('settings.noun.desc') }}</p>
                  </div>
                </div>
                <input
                  class="sm-noun-input"
                  type="text"
                  maxlength="24"
                  :value="store.noun"
                  :placeholder="t('settings.noun.placeholder')"
                  @change="store.setNoun($event.target.value)"
                />
              </div>

              <div class="sm-field">
                <div class="sm-field-head">
                  <span class="sm-field-icon">🧩</span>
                  <div>
                    <div class="sm-field-title">{{ t('settings.programMode.title') }}</div>
                    <p class="sm-field-desc">{{ t('settings.programMode.desc') }}</p>
                  </div>
                </div>
                <div class="sm-segment">
                  <button
                    v-for="m in ['simple', 'standard', 'advanced']"
                    :key="m"
                    class="sm-seg-btn"
                    :class="{ active: store.programMode === m }"
                    @click="store.setProgramMode(m)"
                  >
                    {{ t('mode.' + m) }}
                  </button>
                </div>
              </div>
            </section>

            <!-- ── Help & Docs ─────────────────────────────────────────── -->
            <section v-else-if="active === 'help'" class="sm-section">
              <h3 class="sm-h">{{ t('help.title') }}</h3>
              <p class="sm-intro">{{ t('help.intro') }}</p>

              <h4 class="sm-sub">{{ t('help.gettingStarted.title') }}</h4>
              <ol class="sm-steps">
                <li v-for="(step, i) in t('help.gettingStarted.steps')" :key="i">{{ step }}</li>
              </ol>

              <h4 class="sm-sub">{{ t('help.views.title') }}</h4>
              <dl class="sm-defs">
                <div v-for="(v, i) in t('help.views.items')" :key="i" class="sm-def">
                  <dt>{{ v.name }}</dt>
                  <dd>{{ v.desc }}</dd>
                </div>
              </dl>

              <h4 class="sm-sub">{{ t('help.shortcuts.title') }}</h4>
              <ul class="sm-shortcuts">
                <li v-for="(s, i) in t('help.shortcuts.items')" :key="i">
                  <kbd>{{ s.keys }}</kbd>
                  <span>{{ s.desc }}</span>
                </li>
              </ul>
            </section>

            <!-- ── Feedback ────────────────────────────────────────────── -->
            <section v-else-if="active === 'feedback'" class="sm-section">
              <h3 class="sm-h">{{ t('feedback.title') }}</h3>
              <p class="sm-intro">{{ t('feedback.intro') }}</p>

              <label class="sm-label">{{ t('feedback.typeLabel') }}</label>
              <div class="sm-segment">
                <button
                  v-for="c in feedbackTypes"
                  :key="c"
                  class="sm-seg-btn"
                  :class="{ active: fbType === c }"
                  @click="fbType = c"
                >
                  {{ t('feedback.type.' + c) }}
                </button>
              </div>

              <label class="sm-label">{{ t('feedback.messageLabel') }}</label>
              <textarea
                v-model="fbMessage"
                class="sm-textarea"
                rows="6"
                :placeholder="t('feedback.placeholder')"
              ></textarea>

              <div class="sm-actions">
                <button class="sm-primary" :disabled="!fbMessage.trim()" @click="sendFeedback">
                  ✉ {{ t('feedback.send') }}
                </button>
              </div>
              <p class="sm-note">{{ t('feedback.note') }}</p>
            </section>

            <!-- ── About ───────────────────────────────────────────────── -->
            <section v-else class="sm-section sm-about">
              <div class="sm-about-badge">🌳</div>
              <h3 class="sm-h">{{ t('about.title') }}</h3>
              <p class="sm-intro">{{ t('about.tagline') }}</p>
              <dl class="sm-meta">
                <div class="sm-meta-row">
                  <dt>{{ t('about.versionLabel') }}</dt>
                  <dd>{{ APP_VERSION }}</dd>
                </div>
                <div class="sm-meta-row">
                  <dt>{{ t('about.creatorLabel') }}</dt>
                  <dd>{{ CREATOR_NAME }}</dd>
                </div>
                <div class="sm-meta-row">
                  <dt>{{ t('about.contactLabel') }}</dt>
                  <dd>
                    <a :href="'mailto:' + CREATOR_EMAIL">{{ CREATOR_EMAIL }}</a>
                  </dd>
                </div>
              </dl>
              <p class="sm-note">{{ t('about.tech') }}</p>
              <p class="sm-note">{{ t('about.privacy') }}</p>
            </section>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useMainStore } from '../store/index.js'
import { useI18n } from '../i18n'

const store = useMainStore()
const { t, SUPPORTED_LOCALES } = useI18n()

// Program metadata (single source in the About panel + feedback subject line).
const APP_VERSION = '1.0.0'
const CREATOR_NAME = 'Tommy Chan'
const CREATOR_EMAIL = 'timmy.chan@helthjem.no'

const tabs = [
  { id: 'general', icon: '⚙', labelKey: 'settings.tabs.general' },
  { id: 'help', icon: '❔', labelKey: 'settings.tabs.help' },
  { id: 'feedback', icon: '✉', labelKey: 'settings.tabs.feedback' },
  { id: 'about', icon: 'ℹ', labelKey: 'settings.tabs.about' }
]
const active = ref('general')

const feedbackTypes = ['bug', 'idea', 'praise', 'other']
const fbType = ref('bug')
const fbMessage = ref('')

function close() {
  store.toggleAppSettings(false)
}

// Compose a mailto: so feedback opens in the user's own mail client — no
// backend, no network, keeps the zero-cost / local-first constraints.
function sendFeedback() {
  const msg = fbMessage.value.trim()
  if (!msg) return
  const typeLabel = t('feedback.type.' + fbType.value)
  const subject = `[Family Tree ${APP_VERSION}] ${typeLabel}`
  const href = `mailto:${CREATOR_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(msg)}`
  window.open(href, '_blank')
}

// Reset to a sensible starting tab each time the modal opens; Esc closes.
watch(
  () => store.appSettingsOpen,
  (open) => {
    if (open) active.value = 'general'
  }
)

function onKeydown(e) {
  if (e.key === 'Escape' && store.appSettingsOpen) close()
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.sm-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
}

.sm-box {
  width: min(720px, calc(100vw - 48px));
  height: min(560px, calc(100vh - 48px));
  display: flex;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow);
  overflow: hidden;
}

/* Sidebar */
.sm-nav {
  flex: 0 0 180px;
  background: var(--elevated);
  border-right: 1px solid var(--border);
  padding: 16px 10px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.sm-nav-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.7px;
  color: var(--t3);
  padding: 0 10px 10px;
}

.sm-nav-item {
  display: flex;
  align-items: center;
  gap: 9px;
  border: none;
  background: transparent;
  color: var(--t2);
  font-family: var(--font);
  font-size: 13px;
  font-weight: 600;
  padding: 9px 10px;
  border-radius: 9px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}

.sm-nav-item:hover {
  background: var(--hover);
  color: var(--t1);
}

.sm-nav-item.active {
  background: var(--adim);
  color: var(--accent);
}

.sm-nav-icon {
  font-size: 15px;
  width: 18px;
  text-align: center;
}

/* Panel */
.sm-panel {
  flex: 1;
  position: relative;
  overflow-y: auto;
  padding: 24px 26px;
}

.sm-close {
  position: absolute;
  top: 14px;
  right: 16px;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--t3);
  font-size: 20px;
  cursor: pointer;
  transition: all 0.15s;
}

.sm-close:hover {
  background: var(--hover);
  color: var(--t1);
}

.sm-section {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

/* General fields */
.sm-field {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sm-field-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.sm-field-icon {
  font-size: 18px;
  line-height: 1.3;
}

.sm-field-title {
  color: var(--t1);
  font-size: 14px;
  font-weight: 700;
}

.sm-field-desc {
  color: var(--t3);
  font-size: 12px;
  line-height: 1.5;
  margin: 2px 0 0;
}

.sm-lang-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 8px;
}

.sm-lang {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 11px;
  background: var(--elevated);
  color: var(--t2);
  font-family: var(--font);
  cursor: pointer;
  text-align: left;
  transition: all 0.16s ease;
}

.sm-lang:hover {
  border-color: rgba(108, 142, 245, 0.4);
  color: var(--t1);
}

.sm-lang.active {
  border-color: var(--accent);
  background: var(--adim);
}

.sm-lang-native {
  font-size: 15px;
  font-weight: 700;
  color: var(--t1);
}

.sm-lang-label {
  font-size: 11px;
  color: var(--t3);
}

.sm-lang-check {
  position: absolute;
  top: 10px;
  right: 12px;
  color: var(--accent);
  font-weight: 700;
}

/* Segmented controls */
.sm-noun-input {
  width: 220px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--elevated);
  color: var(--t1);
  font-family: var(--font);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
}

.sm-noun-input:focus {
  border-color: var(--accent);
}

.sm-segment {
  display: inline-flex;
  gap: 3px;
  background: var(--elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 3px;
  align-self: flex-start;
  flex-wrap: wrap;
}

.sm-seg-btn {
  border: none;
  background: transparent;
  color: var(--t2);
  font-family: var(--font);
  font-size: 12.5px;
  font-weight: 600;
  padding: 7px 14px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.sm-seg-btn:hover {
  color: var(--t1);
}

.sm-seg-btn.active {
  background: var(--surface);
  color: var(--accent);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
}

/* Help & About text */
.sm-h {
  color: var(--t1);
  font-size: 17px;
  font-weight: 700;
  margin: 0;
}

.sm-sub {
  color: var(--t1);
  font-size: 13px;
  font-weight: 700;
  margin: 6px 0 0;
}

.sm-intro {
  color: var(--t2);
  font-size: 13px;
  line-height: 1.6;
  margin: 0;
}

.sm-steps {
  margin: 0;
  padding-left: 20px;
  color: var(--t2);
  font-size: 13px;
  line-height: 1.7;
}

.sm-defs {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sm-def {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.sm-def dt {
  color: var(--t1);
  font-size: 12.5px;
  font-weight: 700;
}

.sm-def dd {
  margin: 0;
  color: var(--t3);
  font-size: 12.5px;
  line-height: 1.5;
}

.sm-shortcuts {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sm-shortcuts li {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--t2);
  font-size: 13px;
}

kbd {
  flex: 0 0 auto;
  min-width: 96px;
  text-align: center;
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-bottom-width: 2px;
  border-radius: 6px;
  background: var(--elevated);
  color: var(--t1);
  font-family: var(--font);
  font-size: 11.5px;
  font-weight: 600;
}

/* Feedback */
.sm-label {
  color: var(--t2);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.sm-textarea {
  width: 100%;
  resize: vertical;
  padding: 11px 13px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--elevated);
  color: var(--t1);
  font-family: var(--font);
  font-size: 13px;
  line-height: 1.6;
  outline: none;
  transition: border-color 0.15s;
}

.sm-textarea:focus {
  border-color: var(--accent);
}

.sm-actions {
  display: flex;
}

.sm-primary {
  border: none;
  border-radius: 10px;
  background: var(--accent);
  color: #fff;
  font-family: var(--font);
  font-size: 13px;
  font-weight: 700;
  padding: 9px 18px;
  cursor: pointer;
  transition:
    filter 0.15s,
    opacity 0.15s;
}

.sm-primary:hover:not(:disabled) {
  filter: brightness(1.08);
}

.sm-primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.sm-note {
  color: var(--t3);
  font-size: 11.5px;
  line-height: 1.5;
  margin: 0;
}

/* About */
.sm-about {
  align-items: center;
  text-align: center;
}

.sm-about-badge {
  font-size: 44px;
  margin-top: 8px;
}

.sm-meta {
  width: 100%;
  max-width: 320px;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sm-meta-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 0;
  border-bottom: 1px solid var(--border);
  font-size: 12.5px;
}

.sm-meta-row dt {
  color: var(--t3);
  font-weight: 600;
}

.sm-meta-row dd {
  margin: 0;
  color: var(--t1);
  font-weight: 600;
}

.sm-meta-row a {
  color: var(--accent);
  text-decoration: none;
}

.sm-meta-row a:hover {
  text-decoration: underline;
}

/* Enter/leave */
.settings-modal-enter-active,
.settings-modal-leave-active {
  transition: opacity 0.22s ease;
}
.settings-modal-enter-active .sm-box,
.settings-modal-leave-active .sm-box {
  transition:
    transform 0.26s cubic-bezier(0.34, 1.3, 0.64, 1),
    opacity 0.22s ease;
}
.settings-modal-enter-from,
.settings-modal-leave-to {
  opacity: 0;
}
.settings-modal-enter-from .sm-box,
.settings-modal-leave-to .sm-box {
  transform: translateY(14px) scale(0.97);
  opacity: 0;
}

@media (max-width: 640px) {
  .sm-box {
    flex-direction: column;
    height: min(640px, calc(100vh - 32px));
  }
  .sm-nav {
    flex: 0 0 auto;
    flex-direction: row;
    overflow-x: auto;
    border-right: none;
    border-bottom: 1px solid var(--border);
    padding: 10px;
  }
  .sm-nav-title {
    display: none;
  }
}
</style>
