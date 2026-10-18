<template>
  <div ref="pageRef" class="home" @scroll.passive="onScroll" @mousemove.passive="onAuraMove">
    <!-- Soft light that trails the cursor across the whole page -->
    <div ref="auraRef" class="cursor-aura" aria-hidden="true"></div>

    <!-- ── Nav ─────────────────────────────────────────────────────────── -->
    <header class="nav" :class="{ scrolled }" :style="{ '--progress': scrollProgress }">
      <button class="nav-logo" type="button" @click="scrollTo('top')">
        <span class="nav-logo-mark"><UiIcon name="tree-deciduous" :size="18" /></span>
        <span class="nav-logo-name">Family Tree</span>
      </button>
      <nav class="nav-links">
        <button type="button" @click="scrollTo('features')">{{ t('home.nav.features') }}</button>
        <button type="button" @click="scrollTo('views')">{{ t('home.nav.views') }}</button>
        <button type="button" @click="scrollTo('explore')">{{ t('home.nav.explore') }}</button>
        <button type="button" @click="scrollTo('about')">{{ t('home.nav.about') }}</button>
      </nav>
      <div class="nav-actions">
        <button
          class="icon-btn home-ink-btn"
          :class="{ on: store.isInk }"
          type="button"
          :title="store.isInk ? t('topbar.inkOff') : t('topbar.inkOn')"
          :aria-pressed="store.isInk"
          @click="store.toggleInk()"
        >
          墨
        </button>
        <button
          class="icon-btn"
          type="button"
          :title="store.isLightTheme ? t('topbar.darkMode') : t('topbar.lightMode')"
          :aria-label="store.isLightTheme ? t('topbar.darkMode') : t('topbar.lightMode')"
          @click="store.setTheme(store.isLightTheme ? 'dark' : 'light')"
        >
          <UiIcon :name="store.isLightTheme ? 'moon' : 'sun'" :size="16" />
        </button>
        <!-- Signed in (visiting from the editor): editor shortcut + the same
             account chip as the editor topbar. Signed out: the auth CTAs. -->
        <template v-if="isAuthed">
          <button class="nav-signin" type="button" @click="emit('close')">
            <UiIcon name="square-pen" :size="14" />
            {{ t('home.nav.openEditor') }}
          </button>
          <AccountMenu />
        </template>
        <template v-else>
          <button class="nav-signin" type="button" @click="emit('signin')">
            {{ t('home.nav.signIn') }}
          </button>
          <button class="nav-start" type="button" @click="emit('register')">
            {{ t('home.nav.getStarted') }}
          </button>
        </template>
      </div>
    </header>

    <!-- ── Hero ────────────────────────────────────────────────────────── -->
    <section ref="heroRef" class="hero" @click="onHeroClick">
      <!-- 水墨 ink theme: paper, hills and a 家 watermark under the constellation -->
      <InkBackdrop watermark="家" />
      <div class="hero-aurora" aria-hidden="true">
        <div class="aurora-blob blob-a"></div>
        <div class="aurora-blob blob-b"></div>
        <div class="aurora-blob blob-c"></div>
      </div>
      <canvas ref="heroCanvas" class="hero-canvas"></canvas>
      <div class="hero-vignette"></div>
      <div class="hero-grain" aria-hidden="true"></div>

      <div class="hero-content" :style="heroParallax">
        <p class="hero-eyebrow">
          <UiIcon name="sparkle" :size="12" />
          {{ t('home.hero.eyebrow') }}
          <UiIcon name="sparkle" :size="12" />
        </p>
        <h1 class="hero-title" :class="{ cjk: isCjk }" :aria-label="t('home.hero.titleLabel')">
          <span
            v-for="(word, i) in titleWords"
            :key="i"
            class="word"
            :class="{ grad: word.grad }"
            :style="{ animationDelay: 0.2 + i * 0.09 + 's' }"
            >{{ word.text }}</span
          >
        </h1>
        <p class="hero-sub">{{ t('home.hero.sub') }}</p>
        <div class="hero-ctas">
          <button class="cta-primary magnetic" type="button" @click="primaryAction">
            <UiIcon name="tree-deciduous" :size="18" />
            {{ isAuthed ? t('home.hero.ctaOpen') : t('home.hero.ctaStart') }}
          </button>
          <button
            v-if="!isAuthed"
            class="cta-ghost magnetic"
            type="button"
            :disabled="guestBusy"
            @click="tryDemo"
          >
            <template v-if="!guestBusy">
              <UiIcon name="play" :size="16" />
              {{ t('home.hero.ctaDemo') }}
            </template>
            <span v-else class="demo-spinner"></span>
          </button>
        </div>
        <Transition name="hero-error">
          <p v-if="demoError" class="hero-error">{{ demoError }}</p>
        </Transition>
        <p class="hero-trust">{{ t('home.hero.trust') }}</p>
      </div>

      <button
        class="hero-scroll-cue"
        type="button"
        :title="t('home.hero.scroll')"
        @click="scrollTo('features')"
      >
        <span class="cue-mouse"><span class="cue-wheel"></span></span>
      </button>

      <Transition name="hint">
        <span v-if="!skyClicked" class="hero-hint">
          <UiIcon name="sparkles" :size="14" />
          {{ t('home.hero.hint') }}
        </span>
      </Transition>
    </section>

    <!-- ── Features ────────────────────────────────────────────────────── -->
    <section id="features" class="section">
      <div class="section-head" data-reveal>
        <p class="kicker">{{ t('home.features.kicker') }}</p>
        <h2>
          {{ t('home.features.titleLead') }}<em>{{ t('home.features.titleEm') }}</em
          >{{ t('home.features.titleTail') }}
        </h2>
        <p class="section-sub">{{ t('home.features.sub') }}</p>
      </div>
      <div class="feature-grid">
        <article
          v-for="(f, i) in FEATURES"
          :key="f.id"
          class="feature"
          data-reveal
          :style="{ '--reveal-delay': (i % 3) * 90 + 'ms' }"
          @mousemove="featureGlow"
        >
          <div class="feature-icon"><UiIcon :name="f.icon" :size="22" /></div>
          <h3>{{ t('home.features.items.' + f.id + '.title') }}</h3>
          <p>{{ t('home.features.items.' + f.id + '.text') }}</p>
        </article>
      </div>
    </section>

    <!-- ── View showcase ───────────────────────────────────────────────── -->
    <section id="views" class="section">
      <div class="section-head" data-reveal>
        <p class="kicker">{{ t('home.views.kicker') }}</p>
        <h2>
          {{ t('home.views.titleLead') }}<em>{{ t('home.views.titleEm') }}</em>
        </h2>
        <p class="section-sub">{{ t('home.views.sub') }}</p>
      </div>
      <div data-reveal>
        <ViewShowcase />
      </div>
    </section>

    <!-- ── Stats ───────────────────────────────────────────────────────── -->
    <section ref="statsRef" class="stats" data-reveal>
      <div v-for="s in STATS" :key="s.id" class="stat-block">
        <div class="stat-num">
          <span class="stat-value" :data-target="s.value">0</span
          ><span class="stat-suffix">{{ s.suffix }}</span>
        </div>
        <div class="stat-label">{{ t('home.stats.' + s.id) }}</div>
      </div>
    </section>

    <!-- ── Marquee ─────────────────────────────────────────────────────── -->
    <section class="marquee-zone">
      <p class="marquee-title" data-reveal>{{ t('home.marquee.title') }}</p>
      <div class="marquee">
        <div class="marquee-track">
          <span v-for="(name, i) in marqueeRow1" :key="'a' + i" class="marquee-item">{{
            name
          }}</span>
        </div>
      </div>
      <div class="marquee marquee-reverse">
        <div class="marquee-track">
          <span v-for="(name, i) in marqueeRow2" :key="'b' + i" class="marquee-item alt">{{
            name
          }}</span>
        </div>
      </div>
    </section>

    <!-- ── Community ───────────────────────────────────────────────────── -->
    <section id="explore" class="section">
      <div class="section-head" data-reveal>
        <p class="kicker">{{ t('home.explore.kicker') }}</p>
        <h2>
          {{ t('home.explore.titleLead') }}<em>{{ t('home.explore.titleEm') }}</em
          >{{ t('home.explore.titleTail') }}
        </h2>
        <p class="section-sub">{{ t('home.explore.sub') }}</p>
      </div>
      <div data-reveal>
        <CommunityGallery @start="primaryAction" />
      </div>
    </section>

    <!-- ── About the maker ─────────────────────────────────────────────── -->
    <section id="about" class="section">
      <div class="about-card" data-reveal>
        <div class="about-emblem">
          <div class="about-orbit orbit-1"><span class="orbit-dot"></span></div>
          <div class="about-orbit orbit-2"><span class="orbit-dot pink"></span></div>
          <div class="about-orbit orbit-3"><span class="orbit-dot green"></span></div>
          <div class="about-core"><UiIcon name="tree-deciduous" :size="40" :stroke="1.75" /></div>
          <UiIcon class="emblem-twinkle tw-1" name="sparkle" :size="13" />
          <UiIcon class="emblem-twinkle tw-2" name="sparkle" :size="13" />
          <UiIcon class="emblem-twinkle tw-3" name="sparkle" :size="10" />
        </div>
        <div class="about-text">
          <p class="kicker">{{ t('home.about.kicker') }}</p>
          <h2>{{ t('home.about.title') }}</h2>
          <p>{{ t('home.about.body', { app: APP_NAME }) }}</p>
          <div class="about-actions">
            <a class="about-btn primary" :href="mailtoHello">
              <UiIcon name="mail" :size="16" />
              {{ t('home.about.hello') }}
            </a>
            <a class="about-btn" :href="mailtoIdea">
              <UiIcon name="lightbulb" :size="16" />
              {{ t('home.about.idea') }}
            </a>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Final CTA ───────────────────────────────────────────────────── -->
    <section class="final" data-reveal>
      <div class="final-sky" aria-hidden="true">
        <span class="shoot shoot-1"></span>
        <span class="shoot shoot-2"></span>
        <span class="shoot shoot-3"></span>
      </div>
      <div class="final-border" aria-hidden="true"></div>
      <div class="final-inner">
        <h2>{{ isAuthed ? t('home.final.titleAuthed') : t('home.final.titleGuest') }}</h2>
        <p>{{ isAuthed ? t('home.final.subAuthed') : t('home.final.subGuest') }}</p>
        <button class="cta-primary big magnetic" type="button" @click="primaryAction">
          {{ isAuthed ? t('home.final.ctaAuthed') : t('home.final.ctaGuest') }}
          <UiIcon name="arrow-right" :size="18" />
        </button>
        <p class="final-note">{{ t('home.final.note') }}</p>
      </div>
    </section>

    <!-- ── Footer ──────────────────────────────────────────────────────── -->
    <footer class="footer">
      <div class="footer-top">
        <div class="footer-brand">
          <span class="nav-logo-mark"><UiIcon name="tree-deciduous" :size="18" /></span>
          <div>
            <div class="footer-name">Family Tree</div>
            <div class="footer-tag">{{ t('home.footer.tag') }}</div>
          </div>
        </div>
        <div class="footer-cols">
          <div class="footer-col">
            <h4>{{ t('home.footer.product') }}</h4>
            <button type="button" @click="scrollTo('features')">
              {{ t('home.nav.features') }}
            </button>
            <button type="button" @click="scrollTo('views')">{{ t('home.nav.views') }}</button>
            <button type="button" @click="scrollTo('explore')">{{ t('home.nav.explore') }}</button>
          </div>
          <div class="footer-col">
            <h4>{{ t('home.footer.maker') }}</h4>
            <button type="button" @click="scrollTo('about')">{{ t('home.nav.about') }}</button>
            <a :href="mailtoHello">{{ t('home.footer.contact') }}</a>
          </div>
          <div class="footer-col">
            <h4>{{ t('home.footer.legal') }}</h4>
            <button type="button" @click="openLegal('terms')">{{ t('home.footer.terms') }}</button>
            <button type="button" @click="openLegal('privacy')">
              {{ t('home.footer.privacy') }}
            </button>
          </div>
        </div>
      </div>
      <div class="footer-bottom">
        {{ COPYRIGHT_HOLDER }} · {{ APP_NAME }} · {{ t('home.footer.madeWith') }}
        <UiIcon class="heartbeat" name="heart" :size="13" :label="t('home.footer.love')" />
        {{ t('home.footer.madeAfter') }}
      </div>
    </footer>

    <LegalModal :open="legalOpen" :initial-tab="legalTab" @close="legalOpen = false" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useMainStore } from '../../store/index.js'
import { createHeroConstellation } from './heroConstellation'
import ViewShowcase from './ViewShowcase.vue'
import CommunityGallery from './CommunityGallery.vue'
import LegalModal from '../LegalModal.vue'
import AccountMenu from '../AccountMenu.vue'
import InkBackdrop from '../ui/InkBackdrop.vue'
import UiIcon from '../ui/UiIcon.js'
import { APP_NAME, COPYRIGHT_HOLDER, contactMailto } from '../../lib/appInfo'
import { SUPPORTED_LOCALES, useI18n } from '../../i18n'

const emit = defineEmits(['signin', 'register', 'close'])
const store = useMainStore()
const { t, locale } = useI18n()

// The homepage doubles as the signed-in "About / Explore" page: with a session
// the auth CTAs become "back to the editor" actions and the nav shows the
// same account chip as the editor topbar.
const isAuthed = computed(() => !!store.authUser)

function primaryAction() {
  if (isAuthed.value) emit('close')
  else emit('register')
}

const mailtoHello = contactMailto(`Hello from a ${APP_NAME} visitor`)
const mailtoIdea = contactMailto(`${APP_NAME} feature idea`)

// The hero title animates in word by word. Each locale supplies its own word
// (or short CJK chunk) list; a leading '*' marks the gradient-highlighted ones.
const isCjk = computed(() => locale.value.startsWith('zh'))
const titleWords = computed(() => {
  const words = t('home.hero.titleWords')
  return (Array.isArray(words) ? words : []).map((w) =>
    w.startsWith('*') ? { text: w.slice(1), grad: true } : { text: w }
  )
})

const FEATURES = [
  { id: 'breathes', icon: 'network' },
  { id: 'time', icon: 'hourglass' },
  { id: 'houses', icon: 'groups' },
  { id: 'faces', icon: 'image' },
  { id: 'smooth', icon: 'zap' },
  { id: 'yours', icon: 'lock' }
]

const STATS = [
  { id: 'people', value: 10000, suffix: '+' },
  { id: 'lenses', value: 5, suffix: '' },
  { id: 'languages', value: SUPPORTED_LOCALES.length, suffix: '' },
  { id: 'fps', value: 60, suffix: 'fps' }
]

const DYNASTIES = [
  'House Atreides',
  'The Medici',
  'Clan MacLeod',
  'The Bennets',
  'House Stark',
  'The Skywalkers',
  'The Corleones',
  'House of Habsburg',
  'The Brontës',
  'The Curies',
  'Maison Bonaparte',
  'The Bridgertons',
  'Slekta på Vestlandet',
  'House Targaryen',
  'The Kennedys',
  'Din slekt her'
]
// Duplicate each row so the CSS loop (translateX −50%) is seamless.
const marqueeRow1 = [...DYNASTIES, ...DYNASTIES]
const marqueeRow2 = [
  ...DYNASTIES.slice(8),
  ...DYNASTIES.slice(0, 8),
  ...DYNASTIES.slice(8),
  ...DYNASTIES.slice(0, 8)
]

// ── Hero constellation ───────────────────────────────────────────────────────
const pageRef = ref(null)
const heroRef = ref(null)
const heroCanvas = ref(null)
const statsRef = ref(null)
let hero = null

watch([() => store.theme, () => store.accent], () => hero?.refreshPalette())

// ── Guest demo ───────────────────────────────────────────────────────────────
const guestBusy = ref(false)
const demoError = ref('')

async function tryDemo() {
  if (guestBusy.value) return
  demoError.value = ''
  guestBusy.value = true
  try {
    const res = await store.guestLogin()
    if (!res.success) demoError.value = res.error || t('home.hero.demoError')
  } finally {
    guestBusy.value = false
  }
}

// ── Legal ────────────────────────────────────────────────────────────────────
const legalOpen = ref(false)
const legalTab = ref('terms')

function openLegal(tab) {
  legalTab.value = tab
  legalOpen.value = true
}

// ── Scroll: nav state, progress bar, hero parallax, section navigation ──────
const scrolled = ref(false)
const heroShift = ref(0)
const scrollProgress = ref(0)
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

let scrollRaf = 0
function onScroll() {
  cancelAnimationFrame(scrollRaf)
  scrollRaf = requestAnimationFrame(() => {
    const el = pageRef.value
    const top = el?.scrollTop ?? 0
    scrolled.value = top > 24
    heroShift.value = reducedMotion ? 0 : Math.min(top, 900)
    scrollProgress.value = el
      ? Math.min(1, top / Math.max(1, el.scrollHeight - el.clientHeight))
      : 0
  })
}

// ── Cursor aura: a soft light that trails the pointer over the page ─────────
// Direct DOM writes (no reactivity) — mousemove fires far too often for that.
const auraRef = ref(null)
function onAuraMove(e) {
  if (reducedMotion || !auraRef.value) return
  auraRef.value.style.transform = `translate3d(${e.clientX - 300}px, ${e.clientY - 300}px, 0)`
  auraRef.value.style.opacity = '1'
}

// ── Sky-click hint (the constellation spawns fireworks on click) ────────────
const skyClicked = ref(false)
function onHeroClick(e) {
  if (e.target === heroCanvas.value || e.target === heroRef.value) skyClicked.value = true
}

const heroParallax = computed(() => ({
  transform: `translateY(${heroShift.value * 0.28}px)`,
  opacity: String(Math.max(0, 1 - heroShift.value / 560))
}))

function scrollTo(id) {
  if (id === 'top') {
    pageRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// ── Feature-card cursor glow ─────────────────────────────────────────────────
function featureGlow(e) {
  const el = e.currentTarget
  const rect = el.getBoundingClientRect()
  el.style.setProperty('--mx', e.clientX - rect.left + 'px')
  el.style.setProperty('--my', e.clientY - rect.top + 'px')
}

// ── Scroll reveals + count-ups + magnetic buttons ────────────────────────────
let revealObserver = null
let statsObserver = null
let statsPlayed = false
const magneticCleanups = []

function playCountUps() {
  if (statsPlayed) return
  statsPlayed = true
  const els = statsRef.value?.querySelectorAll('.stat-value') ?? []
  els.forEach((el) => {
    const target = Number(el.dataset.target) || 0
    const start = performance.now()
    const duration = 1500
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      el.textContent = Math.round(target * eased).toLocaleString('en-US')
      if (t < 1) requestAnimationFrame(tick)
    }
    if (reducedMotion) el.textContent = target.toLocaleString('en-US')
    else requestAnimationFrame(tick)
  })
}

function setupMagnetic() {
  if (reducedMotion) return
  pageRef.value?.querySelectorAll('.magnetic').forEach((btn) => {
    const move = (e) => {
      const rect = btn.getBoundingClientRect()
      const nx = (e.clientX - rect.left) / rect.width - 0.5
      const ny = (e.clientY - rect.top) / rect.height - 0.5
      btn.style.transform = `translate(${nx * 7}px, ${ny * 6}px)`
    }
    const leave = () => {
      btn.style.transform = ''
    }
    btn.addEventListener('mousemove', move)
    btn.addEventListener('mouseleave', leave)
    magneticCleanups.push(() => {
      btn.removeEventListener('mousemove', move)
      btn.removeEventListener('mouseleave', leave)
    })
  })
}

onMounted(() => {
  if (heroCanvas.value) {
    hero = createHeroConstellation(heroCanvas.value, (year) => t('home.born', { year }))
  }

  revealObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed')
          revealObserver.unobserve(entry.target)
        }
      }
    },
    { threshold: 0.12, rootMargin: '0px 0px -36px 0px' }
  )
  pageRef.value?.querySelectorAll('[data-reveal]').forEach((el) => revealObserver.observe(el))

  statsObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        playCountUps()
        statsObserver.disconnect()
      }
    },
    { threshold: 0.4 }
  )
  if (statsRef.value) statsObserver.observe(statsRef.value)

  setupMagnetic()
})

onUnmounted(() => {
  hero?.destroy()
  hero = null
  revealObserver?.disconnect()
  statsObserver?.disconnect()
  magneticCleanups.forEach((fn) => fn())
  cancelAnimationFrame(scrollRaf)
})
</script>

<style scoped>
/* ══ Page shell ═══════════════════════════════════════════════════════════ */
.home {
  position: fixed;
  inset: 0;
  z-index: 150;
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--bg);
  color: var(--t1);
  scroll-behavior: smooth;
}

/* CJK title chunks sit flush — no inter-word gap */
.hero-title.cjk .word {
  margin-right: 0;
}

/* ══ Cursor aura ══════════════════════════════════════════════════════════ */
.cursor-aura {
  position: fixed;
  top: 0;
  left: 0;
  width: 600px;
  height: 600px;
  border-radius: 50%;
  pointer-events: none;
  z-index: 4;
  opacity: 0;
  background: radial-gradient(
    circle,
    color-mix(in srgb, var(--accent) 7%, transparent),
    transparent 62%
  );
  transform: translate3d(-100vw, -100vh, 0);
  transition:
    transform 0.22s ease-out,
    opacity 0.6s ease;
}

/* ══ Scroll reveals ═══════════════════════════════════════════════════════ */
[data-reveal] {
  opacity: 0;
  transform: translateY(30px);
  transition:
    opacity 0.7s ease var(--reveal-delay, 0s),
    transform 0.85s cubic-bezier(0.22, 1, 0.36, 1) var(--reveal-delay, 0s);
}

[data-reveal].revealed {
  opacity: 1;
  transform: none;
}

/* ══ Nav ══════════════════════════════════════════════════════════════════ */
.nav {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 26px;
  padding: 14px clamp(18px, 4vw, 44px);
  transition:
    background 0.35s ease,
    border-color 0.35s ease,
    box-shadow 0.35s ease,
    padding 0.35s ease;
  border-bottom: 1px solid transparent;
}

.nav.scrolled {
  background: var(--glass-strong);
  backdrop-filter: blur(16px);
  border-bottom-color: var(--border);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
  padding-top: 9px;
  padding-bottom: 9px;
}

/* reading-progress ribbon along the nav's top edge */
.nav::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2.5px;
  background: linear-gradient(90deg, var(--accent), var(--pink), var(--amber));
  transform: scaleX(var(--progress, 0));
  transform-origin: left;
  pointer-events: none;
}

.nav-logo {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  border: none;
  background: none;
  cursor: pointer;
  font-family: var(--font);
}

.nav-logo-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  color: var(--accent);
  border-radius: 11px;
  background: linear-gradient(135deg, var(--adim), rgba(var(--accent-rgb), 0.32));
  border: 1px solid rgba(var(--accent-rgb), 0.35);
  transition:
    transform 0.35s cubic-bezier(0.34, 1.6, 0.64, 1),
    box-shadow 0.3s ease;
}

.nav-logo:hover .nav-logo-mark {
  transform: rotate(-10deg) scale(1.1);
  box-shadow: 0 0 18px color-mix(in srgb, var(--accent) 45%, transparent);
}

.nav-logo-name {
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.2px;
  color: var(--t1);
}

.nav-links {
  display: flex;
  gap: 4px;
  margin-left: 8px;
}

.nav-links button {
  border: none;
  background: none;
  padding: 7px 12px;
  border-radius: 9px;
  color: var(--t2);
  font-family: var(--font);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition:
    color 0.18s ease,
    background 0.18s ease;
}

.nav-links button:hover {
  color: var(--t1);
  background: var(--hover);
}

.nav-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 9px;
}

.nav-signin {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: var(--ctl-md);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--t1);
  padding: 0 16px;
  border-radius: 10px;
  font-family: var(--font);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.2s ease,
    border-color 0.2s ease;
}

.nav-signin:hover {
  background: var(--hover);
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
}

.nav-start {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: var(--ctl-md);
  border: none;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: var(--on-accent);
  padding: 0 18px;
  border-radius: 10px;
  font-family: var(--font);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition:
    box-shadow 0.25s ease,
    filter 0.2s ease;
}

.nav-start:hover {
  box-shadow: 0 6px 20px color-mix(in srgb, var(--accent) 40%, transparent);
  filter: brightness(1.07);
}

@media (max-width: 720px) {
  .nav-links {
    display: none;
  }
}

/* ══ Hero ═════════════════════════════════════════════════════════════════ */
.hero {
  position: relative;
  min-height: calc(100vh - 62px);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  margin-top: -62px; /* let the constellation run behind the sticky nav */
  padding-top: 62px;
}

.hero-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

/* Aurora: huge blurred color pools drifting behind the constellation */
.hero-aurora {
  position: absolute;
  inset: -12%;
  pointer-events: none;
  filter: blur(70px) saturate(1.25);
  opacity: 0.55;
}

.aurora-blob {
  position: absolute;
  width: 55vmax;
  height: 55vmax;
  border-radius: 50%;
}

.aurora-blob.blob-a {
  top: -22%;
  left: -14%;
  background: radial-gradient(
    circle at 35% 35%,
    color-mix(in srgb, var(--accent) 26%, transparent),
    transparent 62%
  );
  animation: aurora-a 26s ease-in-out infinite alternate;
}

.aurora-blob.blob-b {
  bottom: -26%;
  right: -16%;
  background: radial-gradient(
    circle at 60% 45%,
    color-mix(in srgb, var(--pink) 18%, transparent),
    transparent 62%
  );
  animation: aurora-b 32s ease-in-out infinite alternate;
}

.aurora-blob.blob-c {
  top: 18%;
  left: 42%;
  width: 40vmax;
  height: 40vmax;
  background: radial-gradient(
    circle,
    color-mix(in srgb, var(--green) 13%, transparent),
    transparent 64%
  );
  animation: aurora-c 40s ease-in-out infinite alternate;
}

@keyframes aurora-a {
  to {
    transform: translate(9vmax, 7vmax) rotate(28deg) scale(1.15);
  }
}

@keyframes aurora-b {
  to {
    transform: translate(-8vmax, -6vmax) rotate(-22deg) scale(1.2);
  }
}

@keyframes aurora-c {
  to {
    transform: translate(-10vmax, 5vmax) scale(1.3);
  }
}

/* Film grain — a whisper of texture so the sky doesn't band */
.hero-grain {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.05;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

/* Invitation to play with the constellation */
.hero-hint {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  position: absolute;
  right: clamp(16px, 4vw, 44px);
  bottom: 28px;
  z-index: 1;
  padding: 8px 15px;
  border-radius: 999px;
  border: 1px dashed color-mix(in srgb, var(--accent) 45%, transparent);
  background: var(--glass-strong);
  backdrop-filter: blur(8px);
  color: var(--t2);
  font-size: 12.5px;
  font-weight: 600;
  pointer-events: none;
  animation:
    fade-drop 1s ease 2.6s both,
    hint-bob 3.4s ease-in-out 3.6s infinite;
}

@keyframes hint-bob {
  50% {
    transform: translateY(-5px);
  }
}

.hint-leave-active {
  transition:
    opacity 0.5s ease,
    transform 0.5s ease;
}

.hint-leave-to {
  opacity: 0;
  transform: scale(0.85);
}

.hero-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(
    ellipse 90% 62% at 50% 46%,
    transparent 55%,
    color-mix(in srgb, var(--bg) 78%, transparent) 100%
  );
}

.hero-content {
  position: relative;
  z-index: 1;
  text-align: center;
  max-width: 820px;
  padding: 0 24px;
  pointer-events: none;
}

.hero-content > * {
  pointer-events: auto;
}

.hero-eyebrow {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  text-transform: uppercase;
  font-size: 12.5px;
  font-weight: 800;
  letter-spacing: 3.5px;
  color: var(--accent);
  margin: 0 0 18px;
  animation: fade-drop 0.9s ease both;
}

.hero-title {
  margin: 0;
  font-size: clamp(34px, 6.2vw, 66px);
  font-weight: 800;
  line-height: 1.08;
  letter-spacing: -1px;
}

.word {
  display: inline-block;
  margin-right: 0.24em;
  opacity: 0;
  transform: translateY(26px) rotate(2deg);
  filter: blur(7px);
  animation: word-in 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

@keyframes word-in {
  to {
    opacity: 1;
    transform: none;
    filter: blur(0);
  }
}

.word.grad {
  background: linear-gradient(100deg, var(--accent), var(--pink) 55%, var(--amber));
  background-size: 220% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation:
    word-in 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards,
    grad-slide 6s ease-in-out infinite;
}

@keyframes grad-slide {
  0%,
  100% {
    background-position: 0% 0;
  }
  50% {
    background-position: 100% 0;
  }
}

.hero-sub {
  margin: 22px auto 0;
  max-width: 620px;
  font-size: clamp(14px, 1.7vw, 16.5px);
  line-height: 1.65;
  color: var(--t2);
  animation: fade-drop 0.8s ease 0.75s both;
}

.hero-ctas {
  display: flex;
  justify-content: center;
  gap: 14px;
  flex-wrap: wrap;
  margin-top: 32px;
  animation: fade-drop 0.8s ease 0.95s both;
}

.cta-primary {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 50px;
  border: none;
  border-radius: 14px;
  padding: 0 30px;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: var(--on-accent);
  font-family: var(--font);
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.2px;
  cursor: pointer;
  box-shadow: 0 10px 34px color-mix(in srgb, var(--accent) 32%, transparent);
  transition:
    box-shadow 0.3s ease,
    filter 0.2s ease,
    transform 0.25s ease;
}

/* sonar ring pulsing off the button edge */
.cta-primary::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 55%, transparent);
  animation: cta-pulse 2.6s ease-out infinite;
  pointer-events: none;
}

@keyframes cta-pulse {
  to {
    box-shadow: 0 0 0 15px transparent;
  }
}

/* recurring shine sweep across the face */
.cta-primary::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(
    105deg,
    transparent 42%,
    rgba(255, 255, 255, 0.32) 50%,
    transparent 58%
  );
  background-size: 300% 100%;
  background-position: 200% 0;
  animation: cta-sheen 3.8s ease-in-out infinite;
  pointer-events: none;
}

@keyframes cta-sheen {
  0% {
    background-position: 200% 0;
  }
  55%,
  100% {
    background-position: -100% 0;
  }
}

.cta-primary:hover {
  filter: brightness(1.08);
  box-shadow: 0 14px 44px color-mix(in srgb, var(--accent) 48%, transparent);
}

.cta-primary.big {
  height: 56px;
  padding: 0 38px;
  font-size: 16px;
}

.cta-ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 50px;
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 0 26px;
  background: var(--glass-strong);
  backdrop-filter: blur(10px);
  color: var(--t1);
  font-family: var(--font);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  min-width: 190px;
  transition:
    border-color 0.25s ease,
    background 0.25s ease,
    transform 0.25s ease;
}

.cta-ghost:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--accent) 45%, transparent);
  background: var(--hover);
}

.cta-ghost:disabled {
  cursor: default;
  opacity: 0.75;
}

.demo-spinner {
  display: inline-block;
  width: 15px;
  height: 15px;
  border: 2px solid var(--adim);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  vertical-align: -3px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.hero-error {
  margin: 12px 0 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--danger);
}

.hero-error-enter-active,
.hero-error-leave-active {
  transition: all 0.2s ease;
}

.hero-error-enter-from,
.hero-error-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.hero-trust {
  margin: 20px 0 0;
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: 0.4px;
  color: var(--t3);
  animation: fade-drop 0.8s ease 1.15s both;
}

@keyframes fade-drop {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
}

.hero-scroll-cue {
  position: absolute;
  bottom: 26px;
  left: 50%;
  transform: translateX(-50%);
  border: none;
  background: none;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.2s ease;
  animation: fade-drop 1s ease 1.6s both;
}

.hero-scroll-cue:hover {
  opacity: 1;
}

.cue-mouse {
  display: block;
  width: 22px;
  height: 34px;
  border: 2px solid var(--t2);
  border-radius: 12px;
  position: relative;
}

.cue-wheel {
  position: absolute;
  left: 50%;
  top: 6px;
  width: 3px;
  height: 7px;
  margin-left: -1.5px;
  border-radius: 2px;
  background: var(--t2);
  animation: cue-scroll 1.8s ease-in-out infinite;
}

@keyframes cue-scroll {
  0% {
    transform: translateY(0);
    opacity: 1;
  }
  70% {
    transform: translateY(11px);
    opacity: 0;
  }
  100% {
    transform: translateY(0);
    opacity: 0;
  }
}

/* ══ Sections ═════════════════════════════════════════════════════════════ */
.section {
  position: relative;
  max-width: 1120px;
  margin: 0 auto;
  padding: clamp(60px, 9vw, 110px) clamp(18px, 4vw, 44px);
}

/* Faint drifting nebulae parked behind each section, one hue per stop */
#features::before,
#views::before,
#explore::before {
  content: '';
  position: absolute;
  width: 46vmax;
  height: 46vmax;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.12;
  pointer-events: none;
  z-index: -1;
  animation: nebula-drift 30s ease-in-out infinite alternate;
}

#features::before {
  top: -10%;
  left: -20vmax;
  background: radial-gradient(circle, var(--accent), transparent 60%);
}

#views::before {
  top: 0;
  right: -22vmax;
  background: radial-gradient(circle, var(--pink), transparent 60%);
  animation-delay: -10s;
}

#explore::before {
  bottom: -10%;
  left: -18vmax;
  background: radial-gradient(circle, var(--green), transparent 60%);
  animation-delay: -20s;
}

@keyframes nebula-drift {
  to {
    transform: translate(6vmax, -4vmax) scale(1.18);
  }
}

.section-head {
  text-align: center;
  max-width: 640px;
  margin: 0 auto clamp(34px, 5vw, 56px);
}

.kicker {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 2.6px;
  text-transform: uppercase;
  color: var(--accent);
  margin: 0 0 10px;
}

.section-head h2,
.about-text h2,
.final h2 {
  margin: 0;
  font-size: clamp(24px, 3.6vw, 38px);
  font-weight: 800;
  letter-spacing: -0.6px;
  color: var(--t1);
}

.section-head em {
  font-style: normal;
  background: linear-gradient(100deg, var(--accent), var(--pink));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.section-sub {
  margin: 14px auto 0;
  font-size: 14.5px;
  line-height: 1.65;
  color: var(--t2);
}

/* ══ Features ═════════════════════════════════════════════════════════════ */
.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 18px;
}

.feature {
  --mx: 50%;
  --my: 50%;
  position: relative;
  padding: 26px 24px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--surface);
  overflow: hidden;
  transition:
    border-color 0.3s ease,
    transform 0.3s cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 0.3s ease;
}

.feature::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(
    300px circle at var(--mx) var(--my),
    color-mix(in srgb, var(--accent) 9%, transparent),
    transparent 60%
  );
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.feature:hover {
  transform: translateY(-5px);
  border-color: color-mix(in srgb, var(--accent) 35%, transparent);
  box-shadow: 0 16px 38px rgba(0, 0, 0, 0.22);
}

.feature:hover::before {
  opacity: 1;
}

/* a comet of light orbiting the card's border while hovered */
@property --hspin {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

.feature::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1.5px;
  background: conic-gradient(
    from var(--hspin),
    transparent 0deg 40deg,
    var(--accent) 90deg,
    var(--pink) 130deg,
    transparent 180deg 360deg
  );
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  mask-composite: exclude;
  opacity: 0;
  transition: opacity 0.35s ease;
  animation: hspin-turn 3.2s linear infinite;
  pointer-events: none;
}

.feature:hover::after {
  opacity: 1;
}

@keyframes hspin-turn {
  to {
    --hspin: 360deg;
  }
}

.feature-icon {
  width: 46px;
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
  border-radius: 14px;
  background: linear-gradient(
    135deg,
    var(--adim),
    color-mix(in srgb, var(--accent) 24%, transparent)
  );
  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
  margin-bottom: 16px;
  transition: transform 0.35s cubic-bezier(0.34, 1.4, 0.64, 1);
}

.feature:hover .feature-icon {
  transform: scale(1.12) rotate(-5deg);
}

.feature h3 {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 700;
  color: var(--t1);
}

.feature p {
  margin: 0;
  font-size: 13.3px;
  line-height: 1.65;
  color: var(--t2);
}

/* ══ Stats ════════════════════════════════════════════════════════════════ */
.stats {
  display: flex;
  justify-content: center;
  gap: clamp(26px, 6vw, 84px);
  flex-wrap: wrap;
  max-width: 1020px;
  margin: 0 auto;
  padding: 10px clamp(18px, 4vw, 44px) clamp(50px, 7vw, 80px);
}

.stat-block {
  position: relative;
  text-align: center;
  min-width: 150px;
}

/* soft light breathing behind each number */
.stat-block::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 32%;
  width: 130px;
  height: 130px;
  transform: translate(-50%, -50%);
  background: radial-gradient(
    circle,
    color-mix(in srgb, var(--accent) 15%, transparent),
    transparent 65%
  );
  animation: stat-breathe 4.2s ease-in-out infinite;
  pointer-events: none;
}

.stat-block:nth-child(2)::before {
  animation-delay: -1s;
  background: radial-gradient(
    circle,
    color-mix(in srgb, var(--pink) 13%, transparent),
    transparent 65%
  );
}

.stat-block:nth-child(3)::before {
  animation-delay: -2s;
}

.stat-block:nth-child(4)::before {
  animation-delay: -3s;
  background: radial-gradient(
    circle,
    color-mix(in srgb, var(--amber) 13%, transparent),
    transparent 65%
  );
}

@keyframes stat-breathe {
  50% {
    transform: translate(-50%, -50%) scale(1.3);
    opacity: 0.55;
  }
}

.stat-num {
  font-size: clamp(34px, 4.4vw, 52px);
  font-weight: 800;
  letter-spacing: -1.5px;
  background: linear-gradient(120deg, var(--accent), var(--pink));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.stat-suffix {
  font-size: 0.6em;
}

.stat-label {
  margin-top: 4px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--t3);
  max-width: 180px;
  margin-inline: auto;
}

/* ══ Marquee ══════════════════════════════════════════════════════════════ */
.marquee-zone {
  padding: clamp(30px, 5vw, 60px) 0;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 55%, transparent);
  overflow: hidden;
}

.marquee-title {
  text-align: center;
  margin: 0 0 24px;
  font-size: 12.5px;
  font-weight: 800;
  letter-spacing: 2.4px;
  text-transform: uppercase;
  color: var(--t3);
}

.marquee {
  overflow: hidden;
  mask-image: linear-gradient(90deg, transparent, black 12%, black 88%, transparent);
  padding: 7px 0;
  transform: rotate(-0.8deg);
}

.marquee.marquee-reverse {
  transform: rotate(0.8deg);
}

.marquee-track {
  display: inline-flex;
  gap: 14px;
  white-space: nowrap;
  width: max-content;
  animation: marquee-slide 46s linear infinite;
}

.marquee-reverse .marquee-track {
  animation-direction: reverse;
  animation-duration: 56s;
}

.marquee:hover .marquee-track {
  animation-play-state: paused;
}

@keyframes marquee-slide {
  to {
    transform: translateX(-50%);
  }
}

.marquee-item {
  display: inline-flex;
  align-items: center;
  padding: 9px 20px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--elevated);
  color: var(--t2);
  font-size: 13.5px;
  font-weight: 600;
  transition:
    color 0.2s ease,
    border-color 0.2s ease,
    transform 0.2s ease;
}

.marquee-item:hover {
  color: var(--t1);
  border-color: color-mix(in srgb, var(--accent) 45%, transparent);
  transform: translateY(-2px);
}

.marquee-item.alt:hover {
  border-color: color-mix(in srgb, var(--pink) 45%, transparent);
}

/* ══ About ════════════════════════════════════════════════════════════════ */
.about-card {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: clamp(24px, 4vw, 52px);
  align-items: center;
  padding: clamp(28px, 4vw, 52px);
  border: 1px solid var(--border);
  border-radius: 26px;
  background:
    radial-gradient(
      ellipse 70% 90% at 0% 50%,
      color-mix(in srgb, var(--accent) 7%, transparent),
      transparent
    ),
    var(--surface);
}

@media (max-width: 760px) {
  .about-card {
    grid-template-columns: 1fr;
    text-align: center;
  }
  .about-emblem {
    margin: 0 auto;
  }
  .about-actions {
    justify-content: center;
  }
}

.about-emblem {
  position: relative;
  width: 200px;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.about-core {
  width: 84px;
  height: 84px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
  border-radius: 26px;
  background: linear-gradient(135deg, var(--adim), rgba(var(--accent-rgb), 0.3));
  border: 1px solid rgba(var(--accent-rgb), 0.35);
  box-shadow: 0 10px 34px color-mix(in srgb, var(--accent) 25%, transparent);
  animation: core-float 5s ease-in-out infinite;
}

@keyframes core-float {
  50% {
    transform: translateY(-7px);
  }
}

.about-orbit {
  position: absolute;
  inset: 0;
  border: 1px dashed color-mix(in srgb, var(--t3) 45%, transparent);
  border-radius: 50%;
  animation: orbit-spin 16s linear infinite;
}

.about-orbit.orbit-2 {
  inset: 22px;
  animation-duration: 11s;
  animation-direction: reverse;
}

.about-orbit.orbit-3 {
  inset: 44px;
  animation-duration: 21s;
}

@keyframes orbit-spin {
  to {
    transform: rotate(360deg);
  }
}

.orbit-dot {
  position: absolute;
  top: -5px;
  left: 50%;
  width: 10px;
  height: 10px;
  margin-left: -5px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 12px var(--accent);
}

.orbit-dot.pink {
  background: var(--pink);
  box-shadow: 0 0 12px var(--pink);
}

.orbit-dot.green {
  background: var(--green);
  box-shadow: 0 0 12px var(--green);
}

.emblem-twinkle {
  position: absolute;
  color: var(--amber);
  animation: twinkle 2.8s ease-in-out infinite;
  pointer-events: none;
}

.emblem-twinkle.tw-1 {
  top: 4px;
  right: 20px;
}

.emblem-twinkle.tw-2 {
  bottom: 14px;
  left: 2px;
  color: var(--pink);
  animation-delay: 0.9s;
}

.emblem-twinkle.tw-3 {
  top: 42%;
  right: -8px;
  color: var(--accent);
  animation-delay: 1.7s;
}

@keyframes twinkle {
  0%,
  100% {
    opacity: 0.15;
    transform: scale(0.6) rotate(0deg);
  }
  50% {
    opacity: 1;
    transform: scale(1.15) rotate(45deg);
  }
}

.about-text h2 {
  font-size: clamp(20px, 2.6vw, 27px);
  line-height: 1.3;
}

.about-text p:not(.kicker) {
  margin: 14px 0 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--t2);
}

.about-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 22px;
}

.about-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: var(--ctl-lg);
  padding: 0 20px;
  border-radius: 11px;
  border: 1px solid var(--border);
  background: var(--elevated);
  color: var(--t1);
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.25s ease;
}

.about-btn:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--accent) 45%, transparent);
}

.about-btn.primary {
  border: none;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: var(--on-accent);
}

.about-btn.primary:hover {
  box-shadow: 0 8px 24px color-mix(in srgb, var(--accent) 40%, transparent);
}

/* ══ Final CTA ════════════════════════════════════════════════════════════ */
.final {
  position: relative;
  margin: 0 clamp(16px, 3vw, 40px) clamp(60px, 8vw, 100px);
  border-radius: 30px;
  overflow: hidden;
  border: 1px solid var(--border);
}

.final::before,
.final::after {
  content: '';
  position: absolute;
  width: 60vmax;
  height: 60vmax;
  border-radius: 50%;
  filter: blur(90px);
  opacity: 0.3;
  pointer-events: none;
}

.final::before {
  background: radial-gradient(circle, var(--accent), transparent 62%);
  top: -30vmax;
  left: -18vmax;
  animation: final-drift-a 22s ease-in-out infinite alternate;
}

.final::after {
  background: radial-gradient(circle, var(--pink), transparent 62%);
  bottom: -32vmax;
  right: -20vmax;
  opacity: 0.2;
  animation: final-drift-b 28s ease-in-out infinite alternate;
}

@keyframes final-drift-a {
  to {
    transform: translate(8vmax, 6vmax) scale(1.1);
  }
}

@keyframes final-drift-b {
  to {
    transform: translate(-7vmax, -5vmax) scale(1.12);
  }
}

/* Starfield + shooting stars behind the final call to action */
.final-sky {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    radial-gradient(circle, color-mix(in srgb, var(--t1) 55%, transparent) 1px, transparent 1.6px),
    radial-gradient(circle, color-mix(in srgb, var(--t1) 35%, transparent) 1px, transparent 1.5px);
  background-size:
    190px 170px,
    120px 140px;
  background-position:
    12px 24px,
    64px 88px;
  opacity: 0.4;
  animation: final-twinkle 5s ease-in-out infinite;
}

@keyframes final-twinkle {
  50% {
    opacity: 0.22;
  }
}

.shoot {
  position: absolute;
  width: 120px;
  height: 1.5px;
  left: -8%;
  border-radius: 2px;
  background: linear-gradient(90deg, transparent, var(--t1));
  opacity: 0;
  animation: shoot-across 8s linear infinite;
}

.shoot-1 {
  top: 16%;
}

.shoot-2 {
  top: 42%;
  animation-delay: 3.2s;
  animation-duration: 10s;
}

.shoot-3 {
  top: 68%;
  animation-delay: 5.8s;
  animation-duration: 12s;
}

@keyframes shoot-across {
  0% {
    transform: rotate(16deg) translateX(0);
    opacity: 0;
  }
  3% {
    opacity: 0.8;
  }
  13% {
    transform: rotate(16deg) translateX(76vw);
    opacity: 0;
  }
  100% {
    transform: rotate(16deg) translateX(76vw);
    opacity: 0;
  }
}

/* slowly revolving gradient border around the whole card */
@property --fspin {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

.final-border {
  position: absolute;
  inset: 0;
  border-radius: 30px;
  padding: 1.5px;
  background: conic-gradient(
    from var(--fspin),
    color-mix(in srgb, var(--accent) 70%, transparent),
    color-mix(in srgb, var(--pink) 50%, transparent),
    color-mix(in srgb, var(--amber) 40%, transparent),
    color-mix(in srgb, var(--accent) 70%, transparent)
  );
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  mask-composite: exclude;
  animation: fspin-turn 10s linear infinite;
  opacity: 0.7;
  pointer-events: none;
  z-index: 2;
}

@keyframes fspin-turn {
  to {
    --fspin: 360deg;
  }
}

.final-inner {
  position: relative;
  z-index: 1;
  text-align: center;
  padding: clamp(56px, 8vw, 96px) 24px;
  background: color-mix(in srgb, var(--surface) 40%, transparent);
}

.final-inner p {
  margin: 14px 0 28px;
  color: var(--t2);
  font-size: 15px;
}

.final-note {
  margin: 18px 0 0 !important;
  font-size: 12.5px !important;
  font-weight: 600;
  letter-spacing: 0.4px;
  color: var(--t3) !important;
}

/* ══ Footer ═══════════════════════════════════════════════════════════════ */
.footer {
  border-top: 1px solid var(--border);
  padding: clamp(36px, 5vw, 56px) clamp(18px, 4vw, 44px) 26px;
  max-width: 1120px;
  margin: 0 auto;
}

.footer-top {
  display: flex;
  justify-content: space-between;
  gap: 40px;
  flex-wrap: wrap;
}

.footer-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.footer-name {
  font-size: 15px;
  font-weight: 800;
  color: var(--t1);
}

.footer-tag {
  font-size: 12.5px;
  color: var(--t3);
}

.footer-cols {
  display: flex;
  gap: clamp(30px, 6vw, 80px);
  flex-wrap: wrap;
}

.footer-col {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.footer-col h4 {
  margin: 0 0 4px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 1.6px;
  text-transform: uppercase;
  color: var(--t3);
}

.footer-col button,
.footer-col a {
  border: none;
  background: none;
  padding: 0;
  text-align: left;
  font-family: var(--font);
  font-size: 13px;
  font-weight: 500;
  color: var(--t2);
  cursor: pointer;
  text-decoration: none;
  transition: color 0.18s ease;
}

.footer-col button:hover,
.footer-col a:hover {
  color: var(--accent);
}

.footer-bottom {
  margin-top: 38px;
  padding-top: 18px;
  border-top: 1px solid var(--border);
  text-align: center;
  font-size: 12.5px;
  color: var(--t3);
}

.heartbeat {
  display: inline-block;
  vertical-align: -2px;
  fill: currentColor;
  color: var(--pink);
  animation: heart-thump 1.7s ease-in-out infinite;
}

@keyframes heart-thump {
  0%,
  50%,
  100% {
    transform: scale(1);
  }
  12% {
    transform: scale(1.3);
  }
  24% {
    transform: scale(1);
  }
  36% {
    transform: scale(1.22);
  }
}

/* ══ Motion safety ════════════════════════════════════════════════════════ */
@media (prefers-reduced-motion: reduce) {
  .home {
    scroll-behavior: auto;
  }
  [data-reveal] {
    opacity: 1;
    transform: none;
    transition: none;
  }
  .word,
  .hero-eyebrow,
  .hero-sub,
  .hero-ctas,
  .hero-trust,
  .hero-scroll-cue {
    animation: none;
    opacity: 1;
    transform: none;
  }
  .marquee-track,
  .about-orbit,
  .about-core,
  .final::before,
  .final::after,
  .aurora-blob,
  .hero-hint,
  .cta-primary::before,
  .cta-primary::after,
  .feature::after,
  .stat-block::before,
  #features::before,
  #views::before,
  #explore::before,
  .emblem-twinkle,
  .final-sky,
  .shoot,
  .final-border,
  .heartbeat {
    animation: none;
  }
  .cursor-aura {
    display: none;
  }
  .hero-hint {
    opacity: 1;
  }
}

/* ── 水墨 ink theme ───────────────────────────────────────────────────────
   The landing page as a long handscroll: rice paper throughout, the hero's
   constellation drawn over misty hills (<InkBackdrop>), panels in silk
   mounts, calls to action pressed as cinnabar seals. */
:root[data-theme='ink'] .home {
  background-color: var(--bg);
  background-image:
    linear-gradient(rgba(236, 227, 207, 0.35), rgba(236, 227, 207, 0.35)), var(--ink-paper, none);
  background-size:
    100% 100%,
    512px 512px;
}
:root[data-theme='ink'] .cursor-aura {
  background: radial-gradient(circle, rgba(40, 30, 18, 0.06), transparent 62%);
}
:root[data-theme='ink'] .hero-aurora,
:root[data-theme='ink'] .hero-grain {
  display: none;
}
:root[data-theme='ink'] .hero-vignette {
  background: radial-gradient(
    ellipse 70% 55% at 50% 46%,
    rgba(245, 239, 224, 0.75),
    transparent 75%
  );
}
:root[data-theme='ink'] .nav.scrolled {
  background: color-mix(in srgb, var(--surface) 90%, transparent);
  backdrop-filter: none;
  box-shadow:
    0 1px 0 rgba(48, 36, 20, 0.3),
    0 3px 0 rgba(245, 239, 224, 0.9),
    0 4px 0 rgba(48, 36, 20, 0.16);
}
:root[data-theme='ink'] .nav::after {
  height: 4px;
  background: var(--ink-wood);
}
:root[data-theme='ink'] .nav-logo-mark {
  border-radius: 3px;
  background: var(--ink-seal, var(--accent)) center / contain no-repeat;
  mix-blend-mode: multiply;
  border: none;
  box-shadow: none;
}
:root[data-theme='ink'] .nav-logo-mark .ui-icon {
  display: none;
}
:root[data-theme='ink'] .nav-logo-name {
  font-family: var(--font-brush);
  font-size: 21px;
  font-weight: 400;
}
:root[data-theme='ink'] .nav-links button,
:root[data-theme='ink'] .nav-signin {
  font-family: var(--font-ink-label);
  font-size: 14px;
}
:root[data-theme='ink'] .nav-signin {
  border-radius: 3px 5px 4px 6px / 5px 3px 6px 4px;
  background: rgba(255, 251, 240, 0.6);
}
:root[data-theme='ink'] .nav-start,
:root[data-theme='ink'] .cta-primary,
:root[data-theme='ink'] .about-btn.primary {
  border-radius: 2px 4px 3px 5px / 4px 2px 5px 3px;
  background:
    var(--ink-paper-light, none) center / 256px 256px,
    var(--accent);
  background-blend-mode: multiply, normal;
  box-shadow:
    inset 0 0 0 1px rgba(90, 15, 10, 0.3),
    inset 0 0 8px rgba(90, 15, 10, 0.25),
    0 6px 18px rgba(140, 36, 28, 0.25);
  color: var(--on-accent);
  font-family: var(--font-ink-label);
  letter-spacing: 0.04em;
}
:root[data-theme='ink'] .cta-primary::before {
  animation: none;
}
:root[data-theme='ink'] .cta-primary::after {
  background-image: linear-gradient(
    105deg,
    transparent 42%,
    rgba(60, 10, 5, 0.2) 50%,
    transparent 58%
  );
}
:root[data-theme='ink'] .cta-ghost,
:root[data-theme='ink'] .about-btn {
  border-radius: 3px 5px 4px 6px / 5px 3px 6px 4px;
  border-color: var(--ink-mount-line);
  background: rgba(255, 251, 240, 0.7);
  backdrop-filter: none;
  font-family: var(--font-ink-label);
}
:root[data-theme='ink'] .hero-eyebrow,
:root[data-theme='ink'] .kicker,
:root[data-theme='ink'] .stat-label,
:root[data-theme='ink'] .marquee-title,
:root[data-theme='ink'] .footer-col h4 {
  font-family: var(--font-ink-label);
  font-weight: 600;
  font-variant: small-caps;
  text-transform: lowercase;
  letter-spacing: 0.22em;
}
:root[data-theme='ink'] .hero-title {
  font-weight: 400;
  letter-spacing: 0;
  font-size: clamp(40px, 7vw, 78px);
}
/* the highlighted words are written in cinnabar, not a gradient */
:root[data-theme='ink'] .word.grad {
  background: none;
  -webkit-text-fill-color: currentColor;
  color: var(--accent);
  animation: word-in 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
:root[data-theme='ink'] .hero-sub,
:root[data-theme='ink'] .section-sub {
  font-style: italic;
}
:root[data-theme='ink'] .final h2,
:root[data-theme='ink'] .section-head h2,
:root[data-theme='ink'] .about-text h2 {
  font-weight: 400;
}
:root[data-theme='ink'] .section-head em {
  color: var(--accent);
  background: none;
  -webkit-text-fill-color: currentColor;
}
:root[data-theme='ink'] .feature {
  border-radius: 2px;
  border-color: var(--ink-mount-line);
  background: var(--ink-sheet), var(--surface);
  background-size: 512px 512px;
  box-shadow:
    0 0 0 4px var(--ink-silk),
    0 0 0 5px rgba(58, 42, 22, 0.2),
    0 12px 28px rgba(60, 40, 15, 0.12);
}
:root[data-theme='ink'] .feature::before {
  background: radial-gradient(
    300px circle at var(--mx) var(--my),
    rgba(40, 30, 18, 0.07),
    transparent 60%
  );
}
:root[data-theme='ink'] .feature-icon {
  border-radius: 3px;
}
:root[data-theme='ink'] .feature h3 {
  font-size: 21px;
}
:root[data-theme='ink'] .stat-num {
  font-family: var(--font-brush);
  font-weight: 400;
}
:root[data-theme='ink'] .stat-block::before {
  opacity: 0.25;
  filter: grayscale(1);
}
/* the marquee of dynasties: title slips (题签) */
:root[data-theme='ink'] .marquee-item {
  border-radius: 1px;
  border-color: rgba(48, 36, 20, 0.28);
  background: var(--ink-sheet), var(--surface);
  background-size: 512px 512px;
  box-shadow:
    inset 0 0 0 2px var(--surface),
    inset 0 0 0 3px rgba(48, 36, 20, 0.12);
  font-family: var(--font-brush);
  font-size: 17px;
  font-weight: 400;
  color: var(--t1);
}
:root[data-theme='ink'] .about-card {
  border-radius: 2px;
  border-color: var(--ink-mount-line);
  background: var(--ink-sheet), var(--surface);
  background-size: 512px 512px;
  box-shadow:
    0 0 0 4px var(--ink-silk),
    0 0 0 5px rgba(58, 42, 22, 0.2),
    0 12px 28px rgba(60, 40, 15, 0.12);
}
:root[data-theme='ink'] .about-orbit {
  border-color: rgba(28, 26, 23, 0.25);
}
:root[data-theme='ink'] .final {
  border-radius: 2px;
  border-color: var(--ink-mount-line);
  background:
    var(--ink-landscape, none) center bottom / auto 70% repeat-x,
    var(--ink-sheet),
    var(--surface);
  background-size:
    auto 70%,
    512px 512px;
  box-shadow:
    0 0 0 5px var(--ink-silk),
    0 0 0 6px rgba(58, 42, 22, 0.2),
    0 0 0 14px var(--ink-silk-deep),
    0 0 0 15px rgba(40, 28, 14, 0.3);
}
:root[data-theme='ink'] .final::before,
:root[data-theme='ink'] .final::after,
:root[data-theme='ink'] .final-sky,
:root[data-theme='ink'] .shoot,
:root[data-theme='ink'] .final-border {
  display: none;
}
:root[data-theme='ink'] .footer-name {
  font-family: var(--font-brush);
  font-size: 20px;
  font-weight: 400;
}

:root[data-theme='ink'] .hero .inkbd {
  -webkit-mask: linear-gradient(#000 80%, transparent);
  mask: linear-gradient(#000 80%, transparent);
}
.home-ink-btn {
  font-family: var(--font-brush);
  font-size: 16px;
  line-height: 1;
}
.home-ink-btn.on {
  color: #fbf4e6;
  background: #b3352a;
  border-radius: 4px;
}
</style>
