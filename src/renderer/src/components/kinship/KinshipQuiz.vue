<template>
  <Teleport to="body">
    <Transition name="kq">
      <div
        v-if="open"
        class="kq-overlay"
        @click.self="$emit('close')"
        @keydown.esc="$emit('close')"
      >
        <div class="kq" role="dialog" aria-modal="true" :aria-label="t('kinship.quiz.title')">
          <header class="kq-head">
            <span class="kq-title"
              ><UiIcon name="dices" :size="16" />{{ t('kinship.quiz.title') }}</span
            >
            <KinLangPicker />
            <span :key="score" class="kq-score" :title="t('kinship.quiz.score')">
              <UiIcon name="star" :size="14" />{{ score }}
            </span>
            <span
              v-if="streak >= 2"
              :key="'s' + streak"
              class="kq-streak"
              :title="t('kinship.quiz.streak')"
            >
              <UiIcon name="flame" :size="14" />{{ streak }}
            </span>
            <button
              class="kq-x"
              :title="t('kinship.quiz.closeEsc')"
              :aria-label="t('kinship.quiz.close')"
              @click="$emit('close')"
            >
              <UiIcon name="x" :size="16" />
            </button>
          </header>

          <div class="kq-dots">
            <span
              v-for="(r, i) in results"
              :key="i"
              class="kq-dot"
              :class="{ cur: i === qi && !done, ok: r === true, bad: r === false }"
            ></span>
          </div>

          <!-- Not enough family to quiz on -->
          <div v-if="!questions.length" class="kq-empty">
            <UiIcon class="kq-empty-ic" name="sprout" :size="34" :stroke="1.7" />
            <b>{{ t('kinship.quiz.emptyTitle') }}</b>
            <p>{{ t('kinship.quiz.emptyText') }}</p>
          </div>

          <!-- Result screen -->
          <div v-else-if="done" class="kq-end">
            <div class="kq-confetti" aria-hidden="true">
              <span v-for="n in 26" :key="n" :style="confettiStyle(n)"></span>
            </div>
            <svg class="kq-ring" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" class="kq-ring-track" />
              <circle
                cx="60"
                cy="60"
                r="50"
                class="kq-ring-fill"
                :style="{ strokeDashoffset: 314 * (1 - score / questions.length) }"
              />
              <text x="60" y="58" class="kq-ring-n">{{ score }}/{{ questions.length }}</text>
              <text x="60" y="76" class="kq-ring-k">{{ t('kinship.quiz.correct') }}</text>
            </svg>
            <div class="kq-grade">{{ grade.title }}</div>
            <div class="kq-grade-sub">{{ grade.sub }}</div>
            <div class="kq-best">
              {{ t('kinship.quiz.bestStreak') }}
              <UiIcon class="kq-best-ic" name="flame" :size="14" />{{ bestStreak }}
            </div>
            <button class="btn btn-primary" @click="start">
              {{ t('kinship.quiz.playAgain') }}
            </button>
          </div>

          <!-- Question -->
          <Transition v-else name="kq-card" mode="out-in">
            <div :key="qi" class="kq-card">
              <div class="kq-kind">{{ t(`kinship.quiz.kinds.${q.kind}`) }}</div>
              <div class="kq-q">
                <template v-for="(seg, si) in questionParts" :key="si">
                  <span v-if="seg.k === 'rel'" class="kq-rel">{{ relNameNow }}</span>
                  <b v-else-if="seg.k" :style="{ color: personColor(q[seg.k]) }">{{
                    personName(q[seg.k])
                  }}</b>
                  <template v-else>{{ seg.text }}</template>
                </template>
              </div>

              <div class="kq-opts" :class="'kq-opts-' + q.kind">
                <button
                  v-for="(o, i) in optionsNow"
                  :key="o.key"
                  class="kq-opt"
                  :class="optClass(o)"
                  :style="{
                    '--i': i,
                    '--pc': o.personId ? personColor(o.personId) : 'var(--accent)'
                  }"
                  :disabled="picked !== null"
                  @click="answer(o)"
                >
                  <span v-if="o.personId" class="kq-opt-av">{{ initials(o.personId) }}</span>
                  <span class="kq-opt-t">{{ o.personId ? personName(o.personId) : o.label }}</span>
                  <span class="kq-opt-k">{{ 'ABCD'[i] }}</span>
                </button>
              </div>

              <Transition name="kq-reveal">
                <div v-if="picked !== null" class="kq-reveal">
                  <div class="kq-verdict" :class="lastOk ? 'ok' : 'bad'">
                    {{ lastOk ? pickCheer() : t('kinship.quiz.notQuite') }}
                  </div>
                  <KinshipCard v-if="q.kind !== 'hops'" :a="q.a" :b="q.b" />
                  <div v-else class="kq-hops-note">
                    {{
                      t(
                        q.answer === '1'
                          ? 'kinship.quiz.hopsNoteOne'
                          : 'kinship.quiz.hopsNoteOther',
                        {
                          n: q.answer
                        }
                      )
                    }}
                  </div>
                  <button class="btn btn-primary kq-next" @click="next">
                    {{
                      qi === questions.length - 1
                        ? t('kinship.quiz.seeResults')
                        : t('kinship.quiz.next')
                    }}
                    <kbd>Enter</kbd>
                  </button>
                </div>
              </Transition>
            </div>
          </Transition>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { useKinship } from './useKinship'
import { makeQuiz, makeRng } from './kinshipQuiz'
import KinshipCard from './KinshipCard.vue'
import KinLangPicker from './KinLangPicker.vue'
import UiIcon from '../ui/UiIcon.js'
import { useI18n } from '../../i18n'

const props = defineProps({ open: { type: Boolean, default: false } })
defineEmits(['close'])

const K = useKinship()
const { personName, personColor, kinLang } = K
const { t } = useI18n()
const questions = ref([])
const qi = ref(0)
const picked = ref(null)
const results = ref([])
const score = ref(0)
const streak = ref(0)
const bestStreak = ref(0)
const done = ref(false)
const lastOk = ref(false)

const q = computed(() => questions.value[qi.value])

// The question sentence comes from the locale with {a} / {b} / {rel} tokens;
// split it so the names can render as coloured <b>s in any word order.
const questionParts = computed(() => {
  const cur = q.value
  if (!cur) return []
  const src = String(t(`kinship.quiz.questions.${cur.kind}`))
  return src
    .split(/(\{a\}|\{b\}|\{rel\})/)
    .filter(Boolean)
    .map((s) => (s === '{a}' || s === '{b}' || s === '{rel}' ? { k: s.slice(1, -1) } : { text: s }))
})

// Names follow the language picker live, even mid-quiz.
const relNameNow = computed(() => {
  const cur = q.value
  if (!cur || cur.kind === 'hops') return ''
  void kinLang.value
  return K.nameOf(K.lensOf(cur.a).get(cur.b), cur.a, cur.b)
})
const optionsNow = computed(() => {
  const cur = q.value
  if (!cur) return []
  if (cur.kind !== 'name') return cur.options
  // Each name option remembers the pair it was read from — re-name it in the
  // current kinship language so a mid-quiz language switch just works.
  void kinLang.value
  return cur.options.map((o) =>
    o.src ? { ...o, label: K.nameOf(K.lensOf(o.src.a).get(o.src.b), o.src.a, o.src.b) } : o
  )
})

function start() {
  const idx = K.index.value
  const lang = kinLang.value
  const nameOf = (kin, a, b) => K.nameOf(kin, a, b, lang)
  questions.value = makeQuiz(idx, nameOf, makeRng(Date.now() & 0xffffffff), 8)
  qi.value = 0
  picked.value = null
  results.value = questions.value.map(() => null)
  score.value = 0
  streak.value = 0
  bestStreak.value = 0
  done.value = false
}
watch(
  () => props.open,
  (o) => {
    if (o) start()
  }
)

function answer(o) {
  if (picked.value !== null) return
  picked.value = o.key
  const ok = o.key === q.value.answer
  lastOk.value = ok
  results.value[qi.value] = ok
  if (ok) {
    score.value++
    streak.value++
    bestStreak.value = Math.max(bestStreak.value, streak.value)
  } else streak.value = 0
}
function next() {
  if (picked.value === null) return
  if (qi.value >= questions.value.length - 1) {
    done.value = true
    return
  }
  qi.value++
  picked.value = null
}
function optClass(o) {
  if (picked.value === null) return ''
  if (o.key === q.value.answer) return 'right'
  if (o.key === picked.value) return 'wrong'
  return 'faded'
}

const pickCheer = () => {
  const cheers = t('kinship.quiz.cheers')
  return Array.isArray(cheers) ? cheers[(qi.value + score.value) % cheers.length] : cheers
}

const grade = computed(() => {
  const f = questions.value.length ? score.value / questions.value.length : 0
  const tier =
    f >= 0.9
      ? 'keeper'
      : f >= 0.7
        ? 'historian'
        : f >= 0.45
          ? 'cousin'
          : f >= 0.2
            ? 'distant'
            : 'stranger'
  return {
    title: t(`kinship.quiz.grades.${tier}.title`),
    sub: t(`kinship.quiz.grades.${tier}.sub`)
  }
})

function initials(id) {
  const parts = personName(id).trim().split(/\s+/)
  return (
    (parts[0]?.[0] || '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')
  ).toUpperCase()
}
function confettiStyle(n) {
  const a = (n / 26) * Math.PI * 2
  const dist = 90 + ((n * 37) % 70)
  const hues = [
    'var(--kin-blood)',
    'var(--kin-spouse)',
    'var(--accent)',
    'var(--kin-social)',
    'var(--kin-step)'
  ]
  return {
    '--dx': Math.cos(a) * dist + 'px',
    '--dy': Math.sin(a) * dist - 40 + 'px',
    '--r': ((n * 47) % 360) + 'deg',
    '--c': hues[n % hues.length],
    '--delay': (n % 5) * 0.03 + 's'
  }
}

// Keyboard: A–D / 1–4 answer, Enter advances, Esc closes (handled by parent).
function onKey(e) {
  if (!props.open || done.value || !q.value) return
  const i = 'abcd'.indexOf(e.key.toLowerCase())
  const j = '1234'.indexOf(e.key)
  const k = i >= 0 ? i : j
  if (k >= 0 && picked.value === null && optionsNow.value[k]) {
    e.preventDefault()
    answer(optionsNow.value[k])
  } else if (e.key === 'Enter' && picked.value !== null) {
    e.preventDefault()
    next()
  }
}
window.addEventListener('keydown', onKey)
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<style scoped>
.kq-overlay {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: grid;
  place-items: center;
  background: rgba(8, 10, 18, 0.55);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  padding: 16px;
}
.kq {
  position: relative;
  width: min(640px, 100%);
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  padding: 16px 18px 18px;
  border-radius: var(--r-xl);
  background: var(--glass-soft);
  backdrop-filter: blur(18px) saturate(1.3);
  -webkit-backdrop-filter: blur(18px) saturate(1.3);
  border: 1px solid var(--border-strong);
  box-shadow: var(--shadow-lg);
}
.kq-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.kq-title {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 800;
  color: var(--t1);
  margin-right: auto;
}
.kq-score,
.kq-streak {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.kq-score {
  font-weight: 800;
  color: var(--kin-blood);
  font-variant-numeric: tabular-nums;
  animation: kq-bump 0.45s var(--ease-spring);
}
.kq-streak {
  font-weight: 800;
  color: var(--danger);
  animation: kq-bump 0.45s var(--ease-spring);
}
@keyframes kq-bump {
  40% {
    transform: scale(1.45);
  }
}
.kq-x {
  width: var(--ctl-sm);
  height: var(--ctl-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--t3);
  cursor: pointer;
  padding: 0;
  border-radius: var(--r-sm);
}
.kq-x:hover {
  background: var(--hover);
  color: var(--t1);
}
.kq-dots {
  display: flex;
  gap: 5px;
  margin: 10px 0 12px;
}
.kq-dot {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: var(--elevated);
  transition: background 0.3s ease;
}
.kq-dot.cur {
  background: color-mix(in srgb, var(--accent) 55%, var(--elevated));
  animation: kq-glow 1.4s ease-in-out infinite;
}
.kq-dot.ok {
  background: var(--green);
}
.kq-dot.bad {
  background: var(--danger);
}
@keyframes kq-glow {
  50% {
    background: var(--accent);
  }
}
.kq-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.kq-kind {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--accent);
}
.kq-q {
  font-size: 19px;
  font-weight: 650;
  color: var(--t1);
  line-height: 1.35;
}
.kq-rel {
  font-weight: 800;
  color: var(--kin-blood);
}
.kq-opts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.kq-opts-hops {
  grid-template-columns: repeat(4, 1fr);
}
.kq-opt {
  position: relative;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 11px 12px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--elevated);
  color: var(--t1);
  font-family: var(--font);
  font-size: 13.5px;
  font-weight: 650;
  cursor: pointer;
  text-align: left;
  animation: kq-opt-in 0.42s var(--ease-spring) backwards;
  animation-delay: calc(0.08s + var(--i) * 0.06s);
  transition:
    transform 0.18s var(--ease-spring),
    border-color 0.2s ease,
    background 0.25s ease,
    opacity 0.25s ease;
}
.kq-opts-hops .kq-opt {
  justify-content: center;
  font-size: 22px;
  font-weight: 800;
}
@keyframes kq-opt-in {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.96);
  }
}
.kq-opt:hover:not(:disabled) {
  transform: translateY(-2px);
  border-color: var(--accent);
}
.kq-opt-av {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--pc);
  color: #fff;
  font-size: 10.5px;
  font-weight: 800;
  flex-shrink: 0;
}
.kq-opt-t {
  flex: 1;
  min-width: 0;
}
.kq-opt-k {
  font-size: var(--fs-xs);
  font-weight: 800;
  color: var(--t3);
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 0 5px;
}
.kq-opts-hops .kq-opt-k {
  display: none;
}
.kq-opt.right {
  border-color: var(--green);
  background: color-mix(in srgb, var(--green) 20%, var(--elevated));
  animation: kq-right 0.6s var(--ease-spring);
  box-shadow: 0 0 22px color-mix(in srgb, var(--green) 35%, transparent);
}
.kq-opt.wrong {
  border-color: var(--danger);
  background: color-mix(in srgb, var(--danger) 16%, var(--elevated));
  animation: kq-shake 0.45s ease;
}
.kq-opt.faded {
  opacity: 0.4;
}
@keyframes kq-right {
  30% {
    transform: scale(1.06);
  }
}
@keyframes kq-shake {
  20%,
  60% {
    transform: translateX(-6px);
  }
  40%,
  80% {
    transform: translateX(6px);
  }
}
.kq-reveal {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border-radius: 14px;
  background: var(--surface);
  border: 1px solid var(--border);
}
.kq-verdict {
  font-size: 15px;
  font-weight: 800;
}
.kq-verdict.ok {
  color: var(--green);
}
.kq-verdict.bad {
  color: var(--danger);
}
.kq-hops-note {
  font-size: 13px;
  color: var(--t2);
}
.kq-next {
  align-self: flex-end;
}
.kq-next kbd {
  margin-left: 6px;
}
.kq-empty,
.kq-end {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
  padding: 18px 0 6px;
  position: relative;
}
.kq-empty-ic {
  color: var(--t3);
}
.kq-empty p {
  color: var(--t3);
  font-size: 12.5px;
}
.kq-ring {
  width: 132px;
}
.kq-ring-track,
.kq-ring-fill {
  fill: none;
  stroke-width: 9;
}
.kq-ring-track {
  stroke: var(--elevated);
}
.kq-ring-fill {
  stroke: var(--kin-blood);
  stroke-linecap: round;
  stroke-dasharray: 314;
  transform: rotate(-90deg);
  transform-origin: 60px 60px;
  animation: kq-ring 1.2s cubic-bezier(0.22, 1, 0.36, 1) backwards;
}
@keyframes kq-ring {
  from {
    stroke-dashoffset: 314;
  }
}
.kq-ring-n {
  font-size: 24px;
  font-weight: 800;
  fill: var(--t1);
  text-anchor: middle;
}
.kq-ring-k {
  font-size: 11px;
  font-weight: 700;
  fill: var(--t3);
  text-anchor: middle;
  text-transform: uppercase;
}
.kq-grade {
  font-size: 20px;
  font-weight: 800;
  background: linear-gradient(120deg, var(--kin-blood), var(--kin-spouse));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: kq-opt-in 0.6s var(--ease-spring) 0.4s backwards;
}
.kq-grade-sub,
.kq-best {
  font-size: 12.5px;
  color: var(--t2);
}
.kq-best-ic {
  color: var(--danger);
  margin-right: 2px;
}
.kq-confetti {
  position: absolute;
  top: 70px;
  left: 50%;
  pointer-events: none;
}
.kq-confetti span {
  position: absolute;
  width: 7px;
  height: 11px;
  border-radius: 2px;
  background: var(--c);
  opacity: 0;
  animation: kq-burst 1.3s cubic-bezier(0.1, 0.8, 0.3, 1) var(--delay) forwards;
}
@keyframes kq-burst {
  0% {
    opacity: 1;
    transform: translate(0, 0) rotate(0deg) scale(0.6);
  }
  80% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(var(--dx), calc(var(--dy) + 70px)) rotate(var(--r)) scale(1);
  }
}
.kq-enter-active,
.kq-leave-active {
  transition: opacity 0.28s ease;
}
.kq-enter-active .kq,
.kq-leave-active .kq {
  transition:
    transform 0.4s var(--ease-spring),
    opacity 0.28s ease;
}
.kq-enter-from,
.kq-leave-to {
  opacity: 0;
}
.kq-enter-from .kq,
.kq-leave-to .kq {
  transform: translateY(18px) scale(0.96);
  opacity: 0;
}
.kq-card-enter-active,
.kq-card-leave-active {
  transition:
    transform 0.34s var(--ease-out),
    opacity 0.24s ease;
}
.kq-card-enter-from {
  opacity: 0;
  transform: translateX(40px) rotateY(-12deg);
}
.kq-card-leave-to {
  opacity: 0;
  transform: translateX(-40px) rotateY(12deg);
}
.kq-reveal-enter-active {
  transition:
    transform 0.4s var(--ease-spring),
    opacity 0.3s ease;
}
.kq-reveal-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
@media (max-width: 560px) {
  .kq-opts {
    grid-template-columns: 1fr;
  }
  .kq-opts-hops {
    grid-template-columns: repeat(4, 1fr);
  }
}

/* ── 水墨 ink theme: the quiz is a mounted sheet ───────────────────────── */
:root[data-theme='ink'] .kq-overlay {
  background: radial-gradient(ellipse at 50% 40%, rgba(40, 30, 18, 0.22), rgba(28, 20, 10, 0.42));
  backdrop-filter: blur(3px) sepia(0.25);
}
:root[data-theme='ink'] .kq {
  border-radius: 2px;
  border-color: var(--ink-mount-line);
  background: var(--ink-sheet), var(--surface);
  background-size: 512px 512px;
  backdrop-filter: none;
  box-shadow:
    var(--ink-mount-rings),
    0 30px 70px rgba(45, 28, 10, 0.32);
  animation: ink-unroll 0.38s cubic-bezier(0.3, 0.75, 0.3, 1) backwards;
}
:root[data-theme='ink'] .kq-title,
:root[data-theme='ink'] .kq-q {
  font-family: var(--font-brush);
  font-weight: 400;
}
:root[data-theme='ink'] .kq-title {
  font-size: 20px;
}
:root[data-theme='ink'] .kq-rel {
  font-family: var(--font-brush);
}
:root[data-theme='ink'] .kq-opt {
  border-radius: 3px 5px 4px 6px / 5px 3px 6px 4px;
}
:root[data-theme='ink'] .kq-opt-t {
  font-family: var(--font-brush);
  font-weight: 400;
  font-size: 16px;
}
:root[data-theme='ink'] .kq-dot {
  border-radius: 46% 54% 40% 60% / 55% 42% 58% 45%;
}
:root[data-theme='ink'] .kq-ring-n {
  font-family: var(--font-brush);
  font-weight: 400;
}
</style>
