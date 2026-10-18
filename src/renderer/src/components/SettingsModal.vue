<template>
  <Teleport to="body">
    <Transition name="settings-modal">
      <div v-if="store.appSettingsOpen" class="sm-backdrop ink-veil" @click.self="close">
        <div
          class="sm-box ink-mount ink-unroll ink-rollers"
          role="dialog"
          aria-modal="true"
          :aria-label="t('settings.title')"
        >
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
              <UiIcon class="sm-nav-icon" :name="tab.icon" :size="16" />
              <span>{{ t(tab.labelKey) }}</span>
            </button>
          </nav>

          <div class="sm-panel">
            <button
              class="icon-btn sm-close"
              :title="t('settings.close')"
              :aria-label="t('settings.close')"
              @click="close"
            >
              <UiIcon name="x" :size="16" />
            </button>

            <!-- ── General ─────────────────────────────────────────────── -->
            <section v-if="active === 'general'" class="sm-section">
              <div class="sm-field">
                <div class="sm-field-head">
                  <UiIcon class="sm-field-icon" name="globe" :size="18" />
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
                    <span class="sm-lang-label">{{ t('app.langName.' + loc.code) }}</span>
                    <UiIcon
                      v-if="store.language === loc.code"
                      class="sm-lang-check"
                      name="check"
                      :size="16"
                    />
                  </button>
                </div>
              </div>

              <div class="sm-field">
                <div class="sm-field-head">
                  <UiIcon class="sm-field-icon" name="palette" :size="18" />
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
                    <UiIcon name="sun" :size="16" />
                    {{ t('settings.theme.light') }}
                  </button>
                  <button
                    class="sm-seg-btn"
                    :class="{ active: store.theme === 'dark' }"
                    @click="store.setTheme('dark')"
                  >
                    <UiIcon name="moon" :size="16" />
                    {{ t('settings.theme.dark') }}
                  </button>
                  <button
                    class="sm-seg-btn sm-seg-ink"
                    :class="{ active: store.theme === 'ink' }"
                    @click="store.setTheme('ink')"
                  >
                    <span class="sm-ink-seal">墨</span> {{ t('settings.theme.ink') }}
                  </button>
                </div>
              </div>

              <div class="sm-field">
                <div class="sm-field-head">
                  <UiIcon class="sm-field-icon" name="sparkles" :size="18" />
                  <div>
                    <div class="sm-field-title">{{ t('settings.accent.title') }}</div>
                    <p class="sm-field-desc">{{ t('settings.accent.desc') }}</p>
                    <p v-if="store.isInk" class="sm-field-desc">
                      {{ t('settings.accent.inkNote') }}
                    </p>
                  </div>
                </div>
                <div class="sm-accents">
                  <button
                    v-for="a in ACCENT_PRESETS"
                    :key="a.id"
                    class="sm-accent"
                    :class="{ active: store.accent === a.hex }"
                    :style="{ '--sw': a.hex }"
                    :title="t('settings.accent.presets.' + a.id)"
                    :aria-label="t('settings.accent.presets.' + a.id)"
                    :aria-pressed="store.accent === a.hex"
                    @click="pickAccent(a.hex)"
                  >
                    <UiIcon class="sm-accent-check" name="check" :size="15" :stroke="3" />
                  </button>
                  <label
                    class="sm-accent sm-accent-custom"
                    :class="{ active: !ACCENT_PRESETS.some((a) => a.hex === store.accent) }"
                    :style="{ '--sw': customAccent }"
                    :title="t('settings.accent.custom')"
                  >
                    <input
                      type="color"
                      :value="customAccent"
                      :aria-label="t('settings.accent.custom')"
                      @input="onCustomAccent"
                      @change="onCustomAccent"
                    />
                    <UiIcon class="sm-accent-plus" name="plus" :size="16" :stroke="2.5" />
                  </label>
                  <button
                    v-if="store.accent !== DEFAULT_ACCENT"
                    class="btn btn-ghost btn-xs sm-accent-reset"
                    @click="pickAccent(DEFAULT_ACCENT)"
                  >
                    <UiIcon name="rotate-ccw" :size="14" />
                    {{ t('settings.accent.reset') }}
                  </button>
                </div>
              </div>

              <div class="sm-field">
                <div class="sm-field-head">
                  <UiIcon class="sm-field-icon" name="tag" :size="18" />
                  <div>
                    <div class="sm-field-title">{{ t('settings.noun.title') }}</div>
                    <p class="sm-field-desc">{{ t('settings.noun.desc') }}</p>
                  </div>
                </div>
                <input
                  class="sm-noun-input"
                  type="text"
                  maxlength="24"
                  :value="nounLabel(store.noun)"
                  :placeholder="t('settings.noun.placeholder')"
                  @change="store.setNoun($event.target.value)"
                />
              </div>

              <div class="sm-field">
                <div class="sm-field-head">
                  <UiIcon class="sm-field-icon" name="puzzle" :size="18" />
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
                <button class="btn btn-primary" :disabled="!fbMessage.trim()" @click="sendFeedback">
                  <UiIcon name="send" :size="16" />
                  {{ t('feedback.send') }}
                </button>
              </div>
              <p class="sm-note">{{ t('feedback.note') }}</p>
            </section>

            <!-- ── About ───────────────────────────────────────────────── -->
            <section v-else class="sm-section sm-about">
              <div class="sm-about-badge">
                <UiIcon name="tree-deciduous" :size="40" />
              </div>
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
                    <a :href="'mailto:' + CONTACT_EMAIL">{{ CONTACT_EMAIL }}</a>
                  </dd>
                </div>
              </dl>
              <p class="sm-note">{{ t('about.tech') }}</p>
              <p class="sm-note">{{ t('about.privacy') }}</p>
              <p class="sm-note sm-copyright">
                {{ t('about.copyright', { holder: COPYRIGHT_HOLDER }) }}
              </p>
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
import { ACCENT_PRESETS, DEFAULT_ACCENT } from '../lib/accent.js'
import UiIcon from './ui/UiIcon.js'
import { nounLabel } from '../lib/dataLabels'
import {
  APP_NAME,
  APP_VERSION,
  CREATOR_NAME,
  CONTACT_EMAIL,
  COPYRIGHT_HOLDER,
  contactMailto
} from '../lib/appInfo'

const store = useMainStore()
const { t, SUPPORTED_LOCALES } = useI18n()

const tabs = [
  { id: 'general', icon: 'settings', labelKey: 'settings.tabs.general' },
  { id: 'help', icon: 'circle-help', labelKey: 'settings.tabs.help' },
  { id: 'feedback', icon: 'mail', labelKey: 'settings.tabs.feedback' },
  { id: 'about', icon: 'info', labelKey: 'settings.tabs.about' }
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
  const subject = `[${APP_NAME} ${APP_VERSION}] ${typeLabel}`
  window.open(contactMailto(subject, msg), '_blank')
}

// Open on the requested tab (General unless a caller such as the `?` hotkey
// asked for another); Esc closes.
watch([() => store.appSettingsOpen, () => store.appSettingsTab], ([open, tab]) => {
  if (open) active.value = tab || 'general'
})

// ── Accent colour ────────────────────────────────────────────────────────────
const customAccent = ref(store.accent)
watch(
  () => store.accent,
  (hex) => (customAccent.value = hex)
)
function pickAccent(hex) {
  if (hex !== store.accent) store.setAccent(hex)
}
function onCustomAccent(e) {
  // `input` fires continuously while dragging in the native picker — apply
  // live (cheap: a few CSS vars) but persist once the picker settles.
  store.setAccent(e.target.value, { persist: e.type === 'change' })
}

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
  font-size: 12px;
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
  flex-shrink: 0;
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
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--accent);
}

.sm-field-title {
  color: var(--t1);
  font-size: 14px;
  font-weight: 700;
}

.sm-field-desc {
  color: var(--t3);
  font-size: 13px;
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
  border-color: rgba(var(--accent-rgb), 0.4);
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
  font-size: 12.5px;
  color: var(--t3);
}

.sm-lang-check {
  position: absolute;
  top: 10px;
  right: 12px;
  color: var(--accent);
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: var(--ctl-md);
  border: none;
  background: transparent;
  color: var(--t2);
  font-family: var(--font);
  font-size: 13px;
  font-weight: 600;
  padding: 0 14px;
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
  font-size: 14px;
  font-weight: 700;
  margin: 6px 0 0;
}

.sm-intro {
  color: var(--t2);
  font-size: 13.5px;
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
  font-size: 13px;
  font-weight: 700;
}

.sm-def dd {
  margin: 0;
  color: var(--t2);
  font-size: 13px;
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
  font-size: 12.5px;
  font-weight: 600;
}

/* Feedback */
.sm-label {
  color: var(--t2);
  font-size: 12.5px;
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

.sm-note {
  color: var(--t3);
  font-size: 13px;
  line-height: 1.5;
  margin: 0;
}

/* About */
.sm-copyright {
  margin-top: 6px;
  font-size: 12px;
}

.sm-about {
  align-items: center;
  text-align: center;
}

.sm-about-badge {
  display: grid;
  place-items: center;
  width: 72px;
  height: 72px;
  margin-top: 8px;
  border-radius: 22px;
  color: var(--accent);
  background: var(--adim);
  border: 1px solid rgba(var(--accent-rgb), 0.3);
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
  font-size: 13px;
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

/* ── Accent swatches ──────────────────────────────────────────────────────── */
.sm-accents {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.sm-accent {
  position: relative;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: none;
  padding: 0;
  cursor: pointer;
  background: radial-gradient(
    circle at 32% 28%,
    color-mix(in srgb, var(--sw) 55%, #fff),
    var(--sw) 62%
  );
  box-shadow:
    0 0 0 2px var(--surface),
    0 0 0 3px transparent,
    0 3px 10px color-mix(in srgb, var(--sw) 40%, transparent);
  display: grid;
  place-items: center;
  transition:
    transform var(--dur-slow) var(--ease-spring),
    box-shadow var(--dur) ease;
}

.sm-accent:hover {
  transform: translateY(-2px) scale(1.08);
}

.sm-accent.active {
  box-shadow:
    0 0 0 2px var(--surface),
    0 0 0 4px var(--sw),
    0 4px 14px color-mix(in srgb, var(--sw) 55%, transparent);
}

.sm-accent-check {
  color: #fff;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.35));
  transform: scale(0);
  transition: transform var(--dur-slow) var(--ease-spring);
}
.sm-accent.active .sm-accent-check {
  transform: scale(1);
}

.sm-accent-custom {
  background: conic-gradient(#f06292, #f5a623, #4caf72, #22b3c4, #6c8ef5, #9b7cf5, #f06292);
  overflow: hidden;
}
.sm-accent-custom.active {
  background: var(--sw);
}
.sm-accent-custom input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  width: 100%;
  height: 100%;
  padding: 0;
  border: none;
}
.sm-accent-plus {
  color: #fff;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.4));
  pointer-events: none;
}

.sm-accent-reset {
  margin-left: 4px;
}
.sm-ink-seal {
  display: inline-grid;
  place-items: center;
  width: 16px;
  height: 16px;
  font-family: var(--font-brush);
  font-size: 12.5px;
  line-height: 1;
  color: #fbf4e6;
  background: #b3352a;
  border-radius: 2px 3px 2px 4px;
}

/* ── 水墨 ink theme: a hanging scroll (.ink-mount/.ink-unroll/.ink-rollers
   from styles/ink.css). The tab column is the silk band of the mount; the
   active tab is stamped with the family seal. ────────────────────────── */
:root[data-theme='ink'] .sm-box {
  overflow: visible; /* the rollers stick out past the mount */
  position: relative;
}
:root[data-theme='ink'] .sm-nav {
  background:
    repeating-linear-gradient(45deg, rgba(90, 70, 40, 0.035) 0 2px, transparent 2px 5px),
    var(--ink-silk);
  border-right: 1px solid var(--ink-mount-line);
  box-shadow: inset -3px 0 0 rgba(245, 239, 224, 0.7);
}
:root[data-theme='ink'] .sm-nav-title {
  font-family: var(--font-brush);
  font-size: 22px;
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0.04em;
  color: var(--t1);
}
:root[data-theme='ink'] .sm-nav-item {
  border-radius: 2px;
  font-family: var(--font-ink-label);
  font-size: 14px;
  background: radial-gradient(closest-side, rgba(40, 30, 18, 0.1), transparent) center / 0% 0%
    no-repeat;
  transition:
    background-size 0.5s var(--ease-out),
    color 0.15s;
}
:root[data-theme='ink'] .sm-nav-item:hover {
  background-size: 170% 240%;
}
:root[data-theme='ink'] .sm-nav-item.active {
  background: rgba(245, 239, 224, 0.75);
  color: var(--t1);
  box-shadow: inset 0 0 0 1px rgba(58, 42, 22, 0.16);
}
:root[data-theme='ink'] .sm-nav-item.active::after {
  content: '';
  width: 18px;
  height: 18px;
  margin-left: auto;
  background: var(--ink-seal, var(--accent)) center / contain no-repeat;
  mix-blend-mode: multiply;
  animation: ink-stamp 0.45s var(--ease-spring) both;
}
:root[data-theme='ink'] .sm-close {
  border-radius: 3px;
}
:root[data-theme='ink'] .sm-field-title {
  font-family: var(--font-brush);
  font-size: 18px;
  font-weight: 400;
  letter-spacing: 0.02em;
}
:root[data-theme='ink'] .sm-field-desc {
  font-size: 13px;
  color: var(--t2);
}
:root[data-theme='ink'] .sm-field + .sm-field {
  padding-top: 20px;
  background: linear-gradient(rgba(28, 26, 23, 0.16), rgba(28, 26, 23, 0.16)) 28px 0 /
    calc(100% - 28px) 1px no-repeat;
}
:root[data-theme='ink'] .sm-lang {
  border-radius: 2px;
  background: var(--ink-sheet), var(--surface);
  background-size: 512px 512px;
  border-color: rgba(48, 36, 20, 0.2);
}
:root[data-theme='ink'] .sm-lang.active {
  border-color: rgba(179, 53, 42, 0.6);
  box-shadow:
    inset 0 0 0 2px var(--surface),
    inset 0 0 0 3px rgba(179, 53, 42, 0.22);
}
:root[data-theme='ink'] .sm-lang-native {
  font-family: var(--font-brush);
  font-size: 18px;
  font-weight: 400;
}
:root[data-theme='ink'] .sm-segment,
:root[data-theme='ink'] .sm-noun-input,
:root[data-theme='ink'] .sm-textarea {
  border-radius: 3px;
}
:root[data-theme='ink'] .sm-noun-input,
:root[data-theme='ink'] .sm-textarea {
  background: rgba(255, 251, 240, 0.55);
}
:root[data-theme='ink'] .sm-seg-btn {
  border-radius: 2px;
  font-family: var(--font-ink-label);
  font-size: 13.5px;
}
:root[data-theme='ink'] .sm-seg-btn.active {
  background: var(--ink-sheet), var(--surface);
  background-size: 512px 512px;
  box-shadow:
    inset 0 0 0 1px rgba(179, 53, 42, 0.35),
    0 1px 3px rgba(60, 40, 15, 0.18);
}
:root[data-theme='ink'] .sm-h {
  font-family: var(--font-brush);
  font-size: 24px;
  font-weight: 400;
}
:root[data-theme='ink'] .sm-sub {
  font-family: var(--font-brush);
  font-size: 17px;
  font-weight: 400;
}
:root[data-theme='ink'] .sm-actions .btn-primary {
  border-radius: 2px 4px 3px 5px;
  font-family: var(--font-ink-label);
  background:
    var(--ink-paper-light, none) center / 256px 256px,
    var(--accent);
  background-blend-mode: multiply, normal;
}
:root[data-theme='ink'] .sm-accent {
  border-radius: 46% 54% 40% 60% / 55% 42% 58% 45%;
}
</style>
