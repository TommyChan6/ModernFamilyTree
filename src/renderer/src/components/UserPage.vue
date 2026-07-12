<template>
  <Teleport to="body">
    <Transition name="upage">
      <div v-if="store.userPageOpen && store.authUser" class="up-root">
        <!-- Ambient drifting glow, tinted by the avatar hue -->
        <div class="up-aurora" :style="auroraVars">
          <div class="up-blob up-blob-a"></div>
          <div class="up-blob up-blob-b"></div>
        </div>

        <header class="up-topbar">
          <button class="up-back" @click="close">
            <span class="up-back-arrow">←</span>
            {{ t('account.back') }}
          </button>
          <div class="up-topbar-spacer"></div>
          <button class="up-signout" @click="signOut">↩ {{ t('account.security.signOut') }}</button>
        </header>

        <main class="up-scroll">
          <div class="up-content">
            <!-- ── Hero ─────────────────────────────────────────────────── -->
            <section class="up-hero up-reveal" style="--d: 0ms">
              <div class="up-avatar-ring">
                <div class="up-avatar" :style="{ background: previewGradient }">
                  {{ initial }}
                </div>
              </div>
              <div class="up-hero-text">
                <h1 class="up-name">{{ shownName }}</h1>
                <div class="up-handle">@{{ store.authUser.username }}</div>
                <div class="up-hero-meta">
                  <span class="up-plan-badge">{{ planLabel }}</span>
                  <span class="up-since">{{
                    t('account.memberSince', { date: fmtDate(store.authUser.created_at) })
                  }}</span>
                </div>
                <p v-if="store.authUser.bio" class="up-hero-bio">{{ store.authUser.bio }}</p>
              </div>
            </section>

            <!-- ── Profile + Security + Usage cards ─────────────────────── -->
            <div class="up-grid">
              <section class="up-card up-reveal" style="--d: 60ms">
                <h2 class="up-card-title">👤 {{ t('account.profile.title') }}</h2>
                <p class="up-card-desc">{{ t('account.profile.desc') }}</p>

                <label class="up-label">{{ t('account.profile.displayName') }}</label>
                <input
                  v-model="draftName"
                  class="up-input"
                  maxlength="40"
                  :placeholder="t('account.profile.displayNamePh')"
                />

                <label class="up-label">{{ t('account.profile.bio') }}</label>
                <textarea
                  v-model="draftBio"
                  class="up-input up-textarea"
                  rows="3"
                  maxlength="280"
                  :placeholder="t('account.profile.bioPh')"
                ></textarea>
                <div class="up-charcount">{{ draftBio.length }} / 280</div>

                <label class="up-label">{{ t('account.profile.avatar') }}</label>
                <div class="up-swatches">
                  <button
                    class="up-swatch up-swatch-auto"
                    :class="{ active: draftHue === null }"
                    :title="t('account.profile.auto')"
                    @click="draftHue = null"
                  >
                    A
                  </button>
                  <button
                    v-for="h in HUES"
                    :key="h"
                    class="up-swatch"
                    :class="{ active: draftHue === h }"
                    :style="{ background: gradientForHue(h) }"
                    @click="draftHue = h"
                  ></button>
                </div>

                <div class="up-actions">
                  <button
                    class="up-primary"
                    :class="{ 'is-saved': saveState === 'saved' }"
                    :disabled="!profileDirty || saveState === 'saving'"
                    @click="saveProfile"
                  >
                    <span v-if="saveState === 'saved'" class="up-check">✓</span>
                    {{
                      saveState === 'saved' ? t('account.profile.saved') : t('account.profile.save')
                    }}
                  </button>
                  <Transition name="up-fade">
                    <span v-if="profileError" class="up-error">{{ profileError }}</span>
                  </Transition>
                </div>
              </section>

              <section class="up-card up-reveal" style="--d: 120ms">
                <h2 class="up-card-title">🔒 {{ t('account.security.title') }}</h2>
                <p class="up-card-desc">{{ t('account.security.desc') }}</p>

                <label class="up-label">{{ t('account.security.username') }}</label>
                <input class="up-input" :value="store.authUser.username" disabled />
                <div class="up-note">{{ t('account.security.usernameNote') }}</div>

                <label class="up-label">{{ t('account.security.currentPassword') }}</label>
                <input v-model="pwCurrent" class="up-input" type="password" autocomplete="off" />
                <label class="up-label">{{ t('account.security.newPassword') }}</label>
                <input v-model="pwNew" class="up-input" type="password" autocomplete="off" />
                <label class="up-label">{{ t('account.security.confirmPassword') }}</label>
                <input v-model="pwConfirm" class="up-input" type="password" autocomplete="off" />

                <div class="up-actions">
                  <button
                    class="up-primary"
                    :disabled="!pwCurrent || !pwNew || !pwConfirm || pwState === 'saving'"
                    @click="submitPassword"
                  >
                    {{ t('account.security.change') }}
                  </button>
                </div>
                <Transition name="up-fade">
                  <p v-if="pwMessage" class="up-note" :class="{ 'up-error': pwState === 'error' }">
                    {{ pwMessage }}
                  </p>
                </Transition>
              </section>

              <section class="up-card up-reveal" style="--d: 180ms">
                <h2 class="up-card-title">📊 {{ t('account.usage.title') }}</h2>
                <p class="up-card-desc">{{ t('account.usage.desc') }}</p>
                <div v-if="store.authUsage" class="up-usage">
                  <div v-for="row in usageRows" :key="row.label" class="up-usage-row">
                    <div class="up-usage-top">
                      <span class="up-usage-label">{{ row.label }}</span>
                      <span class="up-usage-count">{{ row.used }} / {{ row.max }}</span>
                    </div>
                    <div class="up-usage-track">
                      <div
                        class="up-usage-fill"
                        :class="{ warn: row.ratio > 0.85 }"
                        :style="{ width: barsIn ? Math.min(100, row.ratio * 100) + '%' : '0%' }"
                      ></div>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <!-- ── Projects ─────────────────────────────────────────────── -->
            <section class="up-section up-reveal" style="--d: 240ms">
              <h2 class="up-section-title">🌳 {{ t('account.projects.title') }}</h2>
              <p class="up-card-desc">{{ t('account.projects.desc') }}</p>
              <div class="up-projects">
                <article
                  v-for="(p, i) in overview"
                  :key="p.id"
                  class="up-project"
                  :class="{ active: p.id === store.activeProjectId }"
                  :style="{ '--d': 260 + i * 45 + 'ms' }"
                  @click="openProject(p.id)"
                >
                  <div class="up-project-head">
                    <span class="up-project-name">{{ p.name }}</span>
                    <span v-if="p.id === store.activeProjectId" class="up-project-current">{{
                      t('account.projects.current')
                    }}</span>
                  </div>
                  <div class="up-project-stats">
                    <span :title="t('account.usage.people')">👥 {{ p.counts.persons }}</span>
                    <span :title="t('rail.relationships')">🔗 {{ p.counts.relationships }}</span>
                    <span :title="t('account.usage.photos')">🖼 {{ p.counts.images }}</span>
                  </div>
                  <div class="up-project-foot">
                    <span class="up-project-date">{{
                      t('account.projects.updated', { date: fmtDate(p.updated_at) })
                    }}</span>
                    <span class="up-project-open">{{ t('account.projects.open') }} →</span>
                  </div>
                </article>

                <button class="up-project up-project-new" @click="newProject">
                  <span class="up-project-new-plus">＋</span>
                  <span>{{ t('account.projects.new') }}</span>
                </button>
              </div>
            </section>

            <!-- ── Sharing (preview of the planned feature) ─────────────── -->
            <section class="up-section up-reveal" style="--d: 320ms">
              <div class="up-section-head">
                <h2 class="up-section-title">🌐 {{ t('account.sharing.title') }}</h2>
                <span class="up-soon-badge">{{ t('account.sharing.soon') }}</span>
              </div>
              <p class="up-card-desc">{{ t('account.sharing.desc') }}</p>

              <div class="up-share-preview">
                <div v-for="(mock, i) in shareMocks" :key="i" class="up-share-card">
                  <div class="up-share-kind">{{ mock.kindLabel }}</div>
                  <div class="up-share-name">{{ mock.name }}</div>
                  <div class="up-share-vis">
                    <button
                      v-for="v in ['private', 'link', 'public']"
                      :key="v"
                      class="up-share-pill"
                      :class="{ active: mock.visibility === v }"
                      disabled
                    >
                      {{ t('account.sharing.visibility.' + v) }}
                    </button>
                  </div>
                  <div class="up-share-link">
                    <span class="up-share-url">{{ mock.url }}</span>
                    <button class="up-share-copy" disabled>
                      ⧉ {{ t('account.sharing.copyLink') }}
                    </button>
                  </div>
                </div>
              </div>
              <p class="up-note">🔒 {{ t('account.sharing.mockNote') }}</p>
            </section>
          </div>
        </main>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useMainStore } from '../store/index.js'
import { useI18n } from '../i18n'
import { derivedHue, gradientForHue } from '../lib/avatar.js'

const store = useMainStore()
const { t, locale } = useI18n()

const HUES = [0, 30, 55, 90, 140, 175, 205, 230, 260, 290, 320, 345]

// ── Profile form (draft state, persisted on Save) ───────────────────────────
const draftName = ref('')
const draftBio = ref('')
const draftHue = ref(null)
const saveState = ref('idle') // idle | saving | saved
const profileError = ref('')
let savedTimer = null

const profileDirty = computed(() => {
  const u = store.authUser
  if (!u) return false
  return (
    draftName.value.trim() !== (u.display_name || '') ||
    draftBio.value.trim() !== (u.bio || '') ||
    draftHue.value !== (u.avatar_hue ?? null)
  )
})

function resetDrafts() {
  const u = store.authUser
  draftName.value = u?.display_name || ''
  draftBio.value = u?.bio || ''
  draftHue.value = u?.avatar_hue ?? null
  saveState.value = 'idle'
  profileError.value = ''
}

async function saveProfile() {
  saveState.value = 'saving'
  profileError.value = ''
  const res = await store.updateProfile({
    display_name: draftName.value,
    bio: draftBio.value,
    avatar_hue: draftHue.value
  })
  if (res.success) {
    saveState.value = 'saved'
    clearTimeout(savedTimer)
    savedTimer = setTimeout(() => (saveState.value = 'idle'), 2200)
  } else {
    saveState.value = 'idle'
    profileError.value = res.error || 'Could not save'
  }
}

// ── Password form ────────────────────────────────────────────────────────────
const pwCurrent = ref('')
const pwNew = ref('')
const pwConfirm = ref('')
const pwState = ref('idle') // idle | saving | done | error
const pwMessage = ref('')

async function submitPassword() {
  if (pwNew.value !== pwConfirm.value) {
    pwState.value = 'error'
    pwMessage.value = t('account.security.mismatch')
    return
  }
  pwState.value = 'saving'
  pwMessage.value = ''
  const res = await store.changePassword({
    currentPassword: pwCurrent.value,
    newPassword: pwNew.value
  })
  if (res.success) {
    pwState.value = 'done'
    pwMessage.value = t('account.security.changed')
    pwCurrent.value = pwNew.value = pwConfirm.value = ''
  } else {
    pwState.value = 'error'
    pwMessage.value = res.error || 'Could not change the password'
  }
}

// ── Hero / avatar ────────────────────────────────────────────────────────────
const shownName = computed(() => store.authUser?.display_name || store.authUser?.username || '')
const initial = computed(() => (shownName.value[0] || '?').toUpperCase())
const planLabel = computed(() =>
  store.authUser?.plan === 'free' ? t('account.planFree') : store.authUser?.plan
)
// The hero avatar previews the DRAFT hue so swatch clicks feel immediate.
const previewHue = computed(() => draftHue.value ?? derivedHue(store.authUser?.username))
const previewGradient = computed(() => gradientForHue(previewHue.value))
const auroraVars = computed(() => ({
  '--aurora-a': `hsl(${previewHue.value}, 70%, 55%)`,
  '--aurora-b': `hsl(${(previewHue.value + 60) % 360}, 70%, 50%)`
}))

// ── Usage ────────────────────────────────────────────────────────────────────
const barsIn = ref(false) // width animates 0 → value just after open
const usageRows = computed(() => {
  const u = store.authUsage
  if (!u) return []
  return [
    {
      label: t('account.usage.people'),
      used: u.persons,
      max: u.maxPersons,
      ratio: u.persons / u.maxPersons
    },
    {
      label: t('account.usage.projects'),
      used: u.projects,
      max: u.maxProjects,
      ratio: u.projects / u.maxProjects
    },
    {
      label: t('account.usage.photos'),
      used: u.images,
      max: u.maxImages,
      ratio: u.images / u.maxImages
    }
  ]
})

// ── Projects overview ────────────────────────────────────────────────────────
const overview = ref([])

async function openProject(id) {
  // Close the page first so the switch curtain lifts onto the workspace,
  // not onto a profile page that then animates away.
  close()
  if (id !== store.activeProjectId) await store.switchProject(id)
}

async function newProject() {
  const project = await store.createProject()
  if (project) {
    close()
    await store.switchProject(project.id)
  }
}

// ── Sharing preview (mock data over the user's real projects) ───────────────
const shareMocks = computed(() => {
  const base = overview.value.slice(0, 2)
  const mocks = base.map((p, i) => ({
    kindLabel: t(i === 0 ? 'account.sharing.kindProject' : 'account.sharing.kindImage'),
    name: p.name,
    visibility: i === 0 ? 'link' : 'private',
    url: `familytree.app/s/${p.id.slice(0, 8)}`
  }))
  return mocks
})

// ── Open / close plumbing ────────────────────────────────────────────────────
function close() {
  store.toggleUserPage(false)
}

async function signOut() {
  await store.logout()
}

function fmtDate(s) {
  if (!s) return ''
  const d = new Date(String(s).replace(' ', 'T') + (s.includes('T') ? '' : 'Z'))
  const loc = locale.value === 'zh-Hans' ? 'zh-CN' : locale.value === 'zh-Hant' ? 'zh-TW' : 'en'
  return d.toLocaleDateString(loc, { year: 'numeric', month: 'short', day: 'numeric' })
}

watch(
  () => store.userPageOpen,
  async (open) => {
    if (!open) {
      barsIn.value = false
      return
    }
    resetDrafts()
    pwCurrent.value = pwNew.value = pwConfirm.value = ''
    pwState.value = 'idle'
    pwMessage.value = ''
    store.refreshUsage()
    overview.value = await store.fetchProjectsOverview()
    // Let the bars mount at 0%, then transition to their real widths
    await nextTick()
    requestAnimationFrame(() => (barsIn.value = true))
  }
)

function onKeydown(e) {
  if (e.key === 'Escape' && store.userPageOpen) close()
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  clearTimeout(savedTimer)
})
</script>

<style scoped>
.up-root {
  position: fixed;
  inset: 0;
  z-index: 250;
  background: var(--bg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Ambient aurora ─────────────────────────────────────────────────────── */
.up-aurora {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.up-blob {
  position: absolute;
  width: 55vmax;
  height: 55vmax;
  border-radius: 50%;
  filter: blur(90px);
  opacity: 0.14;
  transition: background 0.6s ease;
}

.up-blob-a {
  background: var(--aurora-a);
  top: -25vmax;
  left: -12vmax;
  animation: up-drift-a 26s ease-in-out infinite alternate;
}

.up-blob-b {
  background: var(--aurora-b);
  bottom: -30vmax;
  right: -15vmax;
  animation: up-drift-b 32s ease-in-out infinite alternate;
}

@keyframes up-drift-a {
  from {
    transform: translate(0, 0) scale(1);
  }
  to {
    transform: translate(9vmax, 6vmax) scale(1.15);
  }
}

@keyframes up-drift-b {
  from {
    transform: translate(0, 0) scale(1.1);
  }
  to {
    transform: translate(-8vmax, -7vmax) scale(0.95);
  }
}

/* ── Top bar ────────────────────────────────────────────────────────────── */
.up-topbar {
  flex: 0 0 52px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 18px;
  position: relative;
  z-index: 2;
}

.up-topbar-spacer {
  flex: 1;
}

.up-back {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--elevated);
  color: var(--t2);
  font-family: var(--font);
  font-size: 12.5px;
  font-weight: 600;
  padding: 7px 14px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.up-back:hover {
  color: var(--t1);
  background: var(--hover);
  border-color: rgba(108, 142, 245, 0.4);
}

.up-back-arrow {
  display: inline-block;
  transition: transform 0.2s ease;
}

.up-back:hover .up-back-arrow {
  transform: translateX(-3px);
}

.up-signout {
  border: none;
  border-radius: 9px;
  background: transparent;
  color: var(--t3);
  font-family: var(--font);
  font-size: 12.5px;
  font-weight: 600;
  padding: 7px 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.up-signout:hover {
  background: rgba(239, 83, 80, 0.12);
  color: #ef5350;
}

/* ── Scroll body ────────────────────────────────────────────────────────── */
.up-scroll {
  flex: 1;
  overflow-y: auto;
  position: relative;
  z-index: 1;
}

.up-content {
  max-width: 860px;
  margin: 0 auto;
  padding: 18px 24px 64px;
  display: flex;
  flex-direction: column;
  gap: 30px;
}

/* Staggered entrance for every section */
.up-reveal {
  animation: up-rise 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: var(--d, 0ms);
}

@keyframes up-rise {
  from {
    opacity: 0;
    transform: translateY(18px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ── Hero ───────────────────────────────────────────────────────────────── */
.up-hero {
  display: flex;
  align-items: center;
  gap: 22px;
  padding: 14px 4px 0;
}

.up-avatar-ring {
  padding: 4px;
  border-radius: 50%;
  border: 1.5px dashed rgba(108, 142, 245, 0.45);
  animation: up-spin 24s linear infinite;
  flex-shrink: 0;
}

/* Counter-rotate the avatar so only the dashed ring appears to spin */
.up-avatar-ring .up-avatar {
  animation: up-spin-rev 24s linear infinite;
}

@keyframes up-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes up-spin-rev {
  to {
    transform: rotate(-360deg);
  }
}

.up-avatar {
  width: 84px;
  height: 84px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 36px;
  font-weight: 800;
  transition: background 0.4s ease;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);
}

.up-hero-text {
  min-width: 0;
}

.up-name {
  margin: 0;
  color: var(--t1);
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.up-handle {
  color: var(--t3);
  font-size: 13px;
  font-weight: 600;
  margin-top: 1px;
}

.up-hero-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
}

.up-plan-badge {
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--adim);
  border: 1px solid rgba(108, 142, 245, 0.35);
  color: var(--accent);
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.4px;
  text-transform: uppercase;
}

.up-since {
  color: var(--t3);
  font-size: 12px;
}

.up-hero-bio {
  margin: 8px 0 0;
  color: var(--t2);
  font-size: 13px;
  line-height: 1.55;
  max-width: 480px;
}

/* ── Cards grid ─────────────────────────────────────────────────────────── */
.up-grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 16px;
}

.up-grid > :nth-child(1) {
  grid-row: span 2;
  align-self: start; /* hug the content — don't stretch to the column's full height */
}

.up-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 20px 22px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: border-color 0.25s ease;
}

.up-card:hover {
  border-color: rgba(108, 142, 245, 0.25);
}

.up-card-title {
  margin: 0;
  color: var(--t1);
  font-size: 15px;
  font-weight: 700;
}

.up-card-desc {
  margin: -4px 0 4px;
  color: var(--t3);
  font-size: 12px;
  line-height: 1.55;
}

.up-label {
  color: var(--t2);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 4px;
}

.up-input {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--elevated);
  color: var(--t1);
  font-family: var(--font);
  font-size: 13px;
  outline: none;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.up-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--adim);
}

.up-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.up-textarea {
  resize: vertical;
  line-height: 1.55;
}

.up-charcount {
  align-self: flex-end;
  color: var(--t3);
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
  margin-top: -6px;
}

/* Avatar hue swatches */
.up-swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.up-swatch {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
  transition:
    transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1),
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.up-swatch:hover {
  transform: scale(1.18);
}

.up-swatch.active {
  border-color: var(--t1);
  transform: scale(1.18);
  box-shadow: 0 0 0 3px var(--adim);
}

.up-swatch-auto {
  background: var(--elevated);
  border: 2px dashed var(--border);
  color: var(--t2);
  font-family: var(--font);
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.up-swatch-auto.active {
  border-style: solid;
  border-color: var(--accent);
  color: var(--accent);
}

.up-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 6px;
}

.up-primary {
  border: none;
  border-radius: 10px;
  background: var(--accent);
  color: #fff;
  font-family: var(--font);
  font-size: 12.5px;
  font-weight: 700;
  padding: 9px 18px;
  cursor: pointer;
  transition:
    filter 0.15s ease,
    opacity 0.15s ease,
    background 0.3s ease,
    transform 0.15s ease;
}

.up-primary:hover:not(:disabled) {
  filter: brightness(1.08);
  transform: translateY(-1px);
}

.up-primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.up-primary.is-saved {
  background: var(--green);
  opacity: 1;
}

.up-check {
  display: inline-block;
  animation: up-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes up-pop {
  from {
    transform: scale(0);
  }
  to {
    transform: scale(1);
  }
}

.up-error {
  color: #ef5350;
  font-size: 12px;
}

.up-note {
  color: var(--t3);
  font-size: 11.5px;
  line-height: 1.5;
  margin: 0;
}

/* ── Usage bars ─────────────────────────────────────────────────────────── */
.up-usage {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.up-usage-top {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.up-usage-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--t2);
}

.up-usage-count {
  font-size: 11px;
  color: var(--t3);
  font-variant-numeric: tabular-nums;
}

.up-usage-track {
  height: 6px;
  border-radius: 3px;
  background: var(--elevated);
  overflow: hidden;
}

.up-usage-fill {
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, var(--accent), #8b6cc5);
  transition: width 0.9s cubic-bezier(0.22, 1, 0.36, 1);
}

.up-usage-fill.warn {
  background: linear-gradient(90deg, var(--amber), #ef5350);
}

/* ── Sections ───────────────────────────────────────────────────────────── */
.up-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.up-section-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.up-section-title {
  margin: 0;
  color: var(--t1);
  font-size: 17px;
  font-weight: 800;
  letter-spacing: -0.2px;
}

/* ── Project cards ──────────────────────────────────────────────────────── */
.up-projects {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(215px, 1fr));
  gap: 14px;
}

.up-project {
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 15px 16px;
  cursor: pointer;
  animation: up-rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: var(--d, 0ms);
  transition:
    transform 0.22s cubic-bezier(0.22, 1, 0.36, 1),
    border-color 0.22s ease,
    box-shadow 0.22s ease;
}

.up-project:hover {
  transform: translateY(-3px);
  border-color: rgba(108, 142, 245, 0.45);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
}

.up-project.active {
  border-color: rgba(108, 142, 245, 0.55);
  background: linear-gradient(var(--surface), var(--surface)) padding-box;
  box-shadow: inset 0 0 0 1px rgba(108, 142, 245, 0.2);
}

.up-project-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.up-project-name {
  color: var(--t1);
  font-size: 13.5px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.up-project-current {
  flex-shrink: 0;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--adim);
  color: var(--accent);
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.4px;
  text-transform: uppercase;
}

.up-project-stats {
  display: flex;
  gap: 14px;
  color: var(--t2);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.up-project-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: auto;
}

.up-project-date {
  color: var(--t3);
  font-size: 10.5px;
}

.up-project-open {
  color: var(--accent);
  font-size: 11px;
  font-weight: 700;
  opacity: 0;
  transform: translateX(-4px);
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.up-project:hover .up-project-open {
  opacity: 1;
  transform: translateX(0);
}

.up-project-new {
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-style: dashed;
  background: transparent;
  color: var(--t3);
  font-family: var(--font);
  font-size: 12.5px;
  font-weight: 600;
  min-height: 108px;
}

.up-project-new:hover {
  color: var(--accent);
  border-color: var(--accent);
  border-style: solid;
}

.up-project-new-plus {
  font-size: 22px;
  font-weight: 300;
  line-height: 1;
}

/* ── Sharing preview ────────────────────────────────────────────────────── */
.up-soon-badge {
  padding: 2px 10px;
  border-radius: 999px;
  border: 1px dashed rgba(245, 166, 35, 0.55);
  color: var(--amber);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  animation: up-soon-pulse 2.6s ease-in-out infinite;
}

@keyframes up-soon-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(245, 166, 35, 0);
  }
  50% {
    box-shadow: 0 0 12px 0 rgba(245, 166, 35, 0.25);
  }
}

.up-share-preview {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

.up-share-card {
  display: flex;
  flex-direction: column;
  gap: 9px;
  background: var(--surface);
  border: 1px dashed var(--border);
  border-radius: 14px;
  padding: 15px 16px;
  opacity: 0.75;
  transition: opacity 0.25s ease;
}

.up-share-card:hover {
  opacity: 0.95;
}

.up-share-kind {
  color: var(--t3);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.up-share-name {
  color: var(--t1);
  font-size: 13.5px;
  font-weight: 700;
}

.up-share-vis {
  display: inline-flex;
  gap: 3px;
  background: var(--elevated);
  border: 1px solid var(--border);
  border-radius: 9px;
  padding: 3px;
  align-self: flex-start;
}

.up-share-pill {
  border: none;
  background: transparent;
  color: var(--t3);
  font-family: var(--font);
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 7px;
  cursor: not-allowed;
}

.up-share-pill.active {
  background: var(--surface);
  color: var(--accent);
}

.up-share-link {
  display: flex;
  align-items: center;
  gap: 8px;
}

.up-share-url {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--elevated);
  color: var(--t3);
  font-size: 11.5px;
}

.up-share-copy {
  flex-shrink: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--elevated);
  color: var(--t3);
  font-family: var(--font);
  font-size: 11px;
  font-weight: 600;
  padding: 6px 10px;
  cursor: not-allowed;
}

/* ── Page enter/leave ───────────────────────────────────────────────────── */
.upage-enter-active {
  transition:
    opacity 0.3s ease,
    transform 0.38s cubic-bezier(0.22, 1, 0.36, 1);
}

.upage-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}

.upage-enter-from {
  opacity: 0;
  transform: translateY(22px) scale(0.99);
}

.upage-leave-to {
  opacity: 0;
  transform: scale(1.015);
}

.up-fade-enter-active,
.up-fade-leave-active {
  transition: opacity 0.2s ease;
}

.up-fade-enter-from,
.up-fade-leave-to {
  opacity: 0;
}

@media (max-width: 720px) {
  .up-grid {
    grid-template-columns: 1fr;
  }
  .up-grid > :nth-child(1) {
    grid-row: auto;
  }
  .up-hero {
    flex-direction: column;
    text-align: center;
  }
  .up-hero-meta {
    justify-content: center;
  }
}
</style>
