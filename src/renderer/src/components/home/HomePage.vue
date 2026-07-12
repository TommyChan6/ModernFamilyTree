<template>
  <div ref="pageRef" class="home" @scroll.passive="onScroll">
    <!-- ── Nav ─────────────────────────────────────────────────────────── -->
    <header class="nav" :class="{ scrolled }">
      <button class="nav-logo" type="button" @click="scrollTo('top')">
        <span class="nav-logo-mark">🌳</span>
        <span class="nav-logo-name">Family Tree</span>
      </button>
      <nav class="nav-links">
        <button type="button" @click="scrollTo('features')">Features</button>
        <button type="button" @click="scrollTo('views')">Views</button>
        <button type="button" @click="scrollTo('explore')">Explore</button>
        <button type="button" @click="scrollTo('about')">About</button>
      </nav>
      <div class="nav-actions">
        <button
          class="icon-btn"
          type="button"
          :title="store.theme === 'dark' ? 'Light mode' : 'Dark mode'"
          @click="store.setTheme(store.theme === 'dark' ? 'light' : 'dark')"
        >
          {{ store.theme === 'dark' ? '☀' : '🌙' }}
        </button>
        <!-- Signed in (visiting from the editor): editor shortcut + the same
             account chip as the editor topbar. Signed out: the auth CTAs. -->
        <template v-if="isAuthed">
          <button class="nav-signin" type="button" @click="emit('close')">✦ Open editor</button>
          <AccountMenu />
        </template>
        <template v-else>
          <button class="nav-signin" type="button" @click="emit('signin')">Sign in</button>
          <button class="nav-start" type="button" @click="emit('register')">Get started</button>
        </template>
      </div>
    </header>

    <!-- ── Hero ────────────────────────────────────────────────────────── -->
    <section ref="heroRef" class="hero">
      <canvas ref="heroCanvas" class="hero-canvas"></canvas>
      <div class="hero-vignette"></div>

      <div class="hero-content" :style="heroParallax">
        <p class="hero-eyebrow">✦ &nbsp;EVERY FAMILY IS A UNIVERSE&nbsp; ✦</p>
        <h1 class="hero-title" aria-label="Turn your family into a living constellation.">
          <span
            v-for="(word, i) in TITLE_WORDS"
            :key="i"
            class="word"
            :class="{ grad: word.grad }"
            :style="{ animationDelay: 0.2 + i * 0.09 + 's' }"
            >{{ word.text }}</span
          >
        </h1>
        <p class="hero-sub">
          Map real ancestors or invented dynasties. Watch lifetimes unfold on a cinematic timeline,
          gather kin into glowing houses, and drift through your tree in 3D — silky smooth at
          thousands of people.
        </p>
        <div class="hero-ctas">
          <button class="cta-primary magnetic" type="button" @click="primaryAction">
            {{ isAuthed ? '🌳 Open your tree' : '🌳 Start your tree — free' }}
          </button>
          <button
            v-if="!isAuthed"
            class="cta-ghost magnetic"
            type="button"
            :disabled="guestBusy"
            @click="tryDemo"
          >
            <span v-if="!guestBusy">▶ Try the live demo</span>
            <span v-else class="demo-spinner"></span>
          </button>
        </div>
        <Transition name="hero-error">
          <p v-if="demoError" class="hero-error">{{ demoError }}</p>
        </Transition>
        <p class="hero-trust">Free forever · Private by default · Desktop &amp; web</p>
      </div>

      <button class="hero-scroll-cue" type="button" title="Scroll" @click="scrollTo('features')">
        <span class="cue-mouse"><span class="cue-wheel"></span></span>
      </button>
    </section>

    <!-- ── Features ────────────────────────────────────────────────────── -->
    <section id="features" class="section">
      <div class="section-head" data-reveal>
        <p class="kicker">Why it feels different</p>
        <h2>Ancestry, but <em>alive</em>.</h2>
        <p class="section-sub">
          Most family tree tools feel like tax software. This one feels like a night sky you get to
          arrange.
        </p>
      </div>
      <div class="feature-grid">
        <article
          v-for="(f, i) in FEATURES"
          :key="f.title"
          class="feature"
          data-reveal
          :style="{ '--reveal-delay': (i % 3) * 90 + 'ms' }"
          @mousemove="featureGlow"
        >
          <div class="feature-icon">{{ f.icon }}</div>
          <h3>{{ f.title }}</h3>
          <p>{{ f.text }}</p>
        </article>
      </div>
    </section>

    <!-- ── View showcase ───────────────────────────────────────────────── -->
    <section id="views" class="section">
      <div class="section-head" data-reveal>
        <p class="kicker">Five lenses</p>
        <h2>One family. <em>Five ways to see it.</em></h2>
        <p class="section-sub">
          Watch the same twelve people rearrange themselves — this is live, go ahead and click.
        </p>
      </div>
      <div data-reveal>
        <ViewShowcase />
      </div>
    </section>

    <!-- ── Stats ───────────────────────────────────────────────────────── -->
    <section ref="statsRef" class="stats" data-reveal>
      <div v-for="s in STATS" :key="s.label" class="stat-block">
        <div class="stat-num">
          <span class="stat-value" :data-target="s.value">0</span
          ><span class="stat-suffix">{{ s.suffix }}</span>
        </div>
        <div class="stat-label">{{ s.label }}</div>
      </div>
    </section>

    <!-- ── Marquee ─────────────────────────────────────────────────────── -->
    <section class="marquee-zone">
      <p class="marquee-title" data-reveal>Room for every kind of family</p>
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
        <p class="kicker">Community · coming soon</p>
        <h2>Explore family <em>universes</em>.</h2>
        <p class="section-sub">
          A peek at the kinds of trees people are growing. Browsing, likes, comments and follows
          launch with our hosted home — every cover below is generated art, not a screenshot.
        </p>
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
          <div class="about-core">🌳</div>
        </div>
        <div class="about-text">
          <p class="kicker">About the maker</p>
          <h2>Handmade by one person who thinks family history deserves better software.</h2>
          <p>
            Hi — I'm Tommy. I built Family Tree because my own family refused to fit in a
            spreadsheet, and every tool I tried felt like filling out forms. No company behind this,
            no tracking, no venture capital — just a long labour of love, shipped from Norway. If it
            makes you map somebody you love (or a dynasty you invented at 2 a.m.), it's doing its
            job.
          </p>
          <div class="about-actions">
            <a class="about-btn primary" :href="mailtoHello">✉️ Say hello</a>
            <a class="about-btn" :href="mailtoIdea">💡 Suggest a feature</a>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Final CTA ───────────────────────────────────────────────────── -->
    <section class="final" data-reveal>
      <div class="final-inner">
        <h2>{{ isAuthed ? 'Your family is waiting.' : "Begin your family's story." }}</h2>
        <p>
          {{
            isAuthed
              ? 'Jump back into the editor and keep the constellation growing.'
              : 'Two minutes from now, your first three generations could be on the canvas.'
          }}
        </p>
        <button class="cta-primary big magnetic" type="button" @click="primaryAction">
          {{ isAuthed ? 'Back to your tree →' : "Start your tree — it's free" }}
        </button>
        <p class="final-note">No downloads required · No credit card · Just your people</p>
      </div>
    </section>

    <!-- ── Footer ──────────────────────────────────────────────────────── -->
    <footer class="footer">
      <div class="footer-top">
        <div class="footer-brand">
          <span class="nav-logo-mark">🌳</span>
          <div>
            <div class="footer-name">Family Tree</div>
            <div class="footer-tag">Every family is a constellation.</div>
          </div>
        </div>
        <div class="footer-cols">
          <div class="footer-col">
            <h4>Product</h4>
            <button type="button" @click="scrollTo('features')">Features</button>
            <button type="button" @click="scrollTo('views')">Views</button>
            <button type="button" @click="scrollTo('explore')">Explore</button>
          </div>
          <div class="footer-col">
            <h4>Maker</h4>
            <button type="button" @click="scrollTo('about')">About</button>
            <a :href="mailtoHello">Contact</a>
          </div>
          <div class="footer-col">
            <h4>Legal</h4>
            <button type="button" @click="openLegal('terms')">Terms of Use</button>
            <button type="button" @click="openLegal('privacy')">Privacy Policy</button>
          </div>
        </div>
      </div>
      <div class="footer-bottom">
        © {{ new Date().getFullYear() }} Family Tree · Made with ♥ and zero venture capital
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

const emit = defineEmits(['signin', 'register', 'close'])
const store = useMainStore()

// The homepage doubles as the signed-in "About / Explore" page: with a session
// the auth CTAs become "back to the editor" actions and the nav shows the
// same account chip as the editor topbar.
const isAuthed = computed(() => !!store.authUser)

function primaryAction() {
  if (isAuthed.value) emit('close')
  else emit('register')
}

const CONTACT_EMAIL = 'timmy.chan@helthjem.no'
const mailtoHello = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Hello from a Family Tree visitor')}`
const mailtoIdea = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Family Tree feature idea')}`

const TITLE_WORDS = [
  { text: 'Turn' },
  { text: 'your' },
  { text: 'family' },
  { text: 'into' },
  { text: 'a' },
  { text: 'living', grad: true },
  { text: 'constellation.', grad: true }
]

const FEATURES = [
  {
    icon: '🕸',
    title: 'A tree that breathes',
    text: 'Physics-driven graphs: drag a grandparent and the whole family sways. Five layouts, from strict generations to free-floating space.'
  },
  {
    icon: '⏳',
    title: 'Time travel',
    text: 'Scrub the time slider and watch people appear, marry and grow old. Lifelines, marriage ribbons and birth sparks — all animated.'
  },
  {
    icon: '🫧',
    title: 'Houses & clans',
    text: 'Tag anyone into groups — farms, dynasties, ship crews — and watch them gather into glowing clusters you can rearrange.'
  },
  {
    icon: '🖼',
    title: 'Faces & stories',
    text: 'Portraits, photos, dates and notes on every person. Build the full cast of your family, not just a chart of names.'
  },
  {
    icon: '⚡',
    title: 'Absurdly smooth',
    text: 'Everything is WebGL. Ten thousand relatives glide at 60fps, ambient animations idle at 0% CPU, and views switch like scenes in a film.'
  },
  {
    icon: '🔒',
    title: 'Yours, full stop',
    text: 'Private by default and works offline. Your data lives with you and exports to a plain file. No ads, no mining, no credit card.'
  }
]

const STATS = [
  { value: 10000, suffix: '+', label: 'people in one tree — still silky' },
  { value: 5, suffix: '', label: 'lenses on every family' },
  { value: 3, suffix: '', label: 'languages, two themes' },
  { value: 60, suffix: 'fps', label: 'with ambient animation at 0% idle CPU' }
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
  'Din slekt her 🌱'
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

watch(
  () => store.theme,
  () => hero?.refreshPalette()
)

// ── Guest demo ───────────────────────────────────────────────────────────────
const guestBusy = ref(false)
const demoError = ref('')

async function tryDemo() {
  if (guestBusy.value) return
  demoError.value = ''
  guestBusy.value = true
  try {
    const res = await store.guestLogin()
    if (!res.success) demoError.value = res.error || 'Could not start the demo — try again'
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

// ── Scroll: nav state, hero parallax, section navigation ────────────────────
const scrolled = ref(false)
const heroShift = ref(0)
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

let scrollRaf = 0
function onScroll() {
  cancelAnimationFrame(scrollRaf)
  scrollRaf = requestAnimationFrame(() => {
    const top = pageRef.value?.scrollTop ?? 0
    scrolled.value = top > 24
    heroShift.value = reducedMotion ? 0 : Math.min(top, 900)
  })
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
  if (heroCanvas.value) hero = createHeroConstellation(heroCanvas.value)

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
  font-size: 17px;
  border-radius: 11px;
  background: linear-gradient(135deg, var(--adim), rgba(108, 142, 245, 0.32));
  border: 1px solid rgba(108, 142, 245, 0.35);
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
  border: 1px solid var(--border);
  background: transparent;
  color: var(--t1);
  padding: 8px 16px;
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
  border: none;
  background: linear-gradient(135deg, var(--accent), #8b6cc5);
  color: #fff;
  padding: 9px 18px;
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
  font-size: 11.5px;
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
  animation: word-in 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

@keyframes word-in {
  to {
    opacity: 1;
    transform: none;
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
  border: none;
  border-radius: 14px;
  padding: 15px 30px;
  background: linear-gradient(135deg, var(--accent), #8b6cc5);
  color: #fff;
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

.cta-primary:hover {
  filter: brightness(1.08);
  box-shadow: 0 14px 44px color-mix(in srgb, var(--accent) 48%, transparent);
}

.cta-primary.big {
  padding: 17px 38px;
  font-size: 16px;
}

.cta-ghost {
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 15px 26px;
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
  font-size: 12.5px;
  font-weight: 600;
  color: #ef5350;
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
  font-size: 11.5px;
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

.section-head {
  text-align: center;
  max-width: 640px;
  margin: 0 auto clamp(34px, 5vw, 56px);
}

.kicker {
  font-size: 11px;
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

.feature-icon {
  width: 46px;
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
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
  font-size: 12.8px;
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
  text-align: center;
  min-width: 150px;
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
  font-size: 12px;
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
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 2.4px;
  text-transform: uppercase;
  color: var(--t3);
}

.marquee {
  overflow: hidden;
  mask-image: linear-gradient(90deg, transparent, black 12%, black 88%, transparent);
  padding: 7px 0;
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
  font-size: 40px;
  border-radius: 26px;
  background: linear-gradient(135deg, var(--adim), rgba(108, 142, 245, 0.3));
  border: 1px solid rgba(108, 142, 245, 0.35);
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
  gap: 7px;
  padding: 11px 20px;
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
  background: linear-gradient(135deg, var(--accent), #8b6cc5);
  color: #fff;
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
  font-size: 11.5px !important;
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
  font-size: 12px;
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
  font-size: 11px;
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
  font-size: 11.5px;
  color: var(--t3);
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
  .final::after {
    animation: none;
  }
}
</style>
