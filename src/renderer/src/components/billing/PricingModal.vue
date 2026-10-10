<template>
  <Teleport to="body">
    <Transition name="pm">
      <div v-if="store.pricingOpen && store.authUser" class="pm-backdrop" @click.self="close">
        <div class="pm-panel" role="dialog" aria-modal="true" :aria-label="t('billing.title')">
          <button
            class="pm-close"
            :title="t('billing.close')"
            :aria-label="t('billing.close')"
            :disabled="busy"
            @click="close"
          >
            <UiIcon name="x" :size="16" />
          </button>

          <!-- ══ Step 1: choose a plan ═══════════════════════════════════ -->
          <div v-if="step === 'plans'" class="pm-scroll">
            <div class="pm-sparkles" aria-hidden="true">
              <UiIcon v-for="n in 12" :key="n" name="sparkle" :size="8 + n" :style="{ '--n': n }" />
            </div>
            <header class="pm-head">
              <p v-if="reason" class="pm-reason">
                <UiIcon :name="reason.icon" :size="16" />
                <span>{{ reason.text }}</span>
              </p>
              <p class="pm-eyebrow">{{ t('billing.eyebrow') }}</p>
              <h2 class="pm-title">{{ t('billing.title') }}</h2>
              <p class="pm-sub">{{ t('billing.subtitle') }}</p>
              <div class="pm-interval" :class="interval" role="group">
                <span class="pm-interval-thumb"></span>
                <button :class="{ on: interval === 'month' }" @click="interval = 'month'">
                  {{ t('billing.monthly') }}
                </button>
                <button :class="{ on: interval === 'year' }" @click="interval = 'year'">
                  {{ t('billing.yearly') }}
                  <span class="pm-save">{{ t('billing.save', { pct: yearlyPct }) }}</span>
                </button>
              </div>
            </header>

            <div class="pm-cards">
              <article
                v-for="(o, i) in PLAN_CATALOG"
                :key="o.id"
                class="pm-card"
                :class="[
                  'tier-' + o.id,
                  { featured: o.featured, current: isCurrent(o), pulse: preselect === o.id }
                ]"
                :style="{ '--i': i }"
              >
                <span v-if="o.featured" class="pm-ribbon">{{ t('billing.popular') }}</span>
                <div class="pm-card-head">
                  <PlanBadge :plan="o.id" big />
                  <p class="pm-tagline">{{ t('billing.plans.' + o.id + '.tagline') }}</p>
                </div>
                <div class="pm-price">
                  <Transition name="pm-num" mode="out-in">
                    <span :key="o.id + interval" class="pm-amount">{{ perMonth(o) }}</span>
                  </Transition>
                  <span class="pm-per">{{
                    o.price.month ? t('billing.perMonth') : t('billing.forever')
                  }}</span>
                </div>
                <p class="pm-billed">
                  <template v-if="!o.price.month">{{ t('billing.noCard') }}</template>
                  <template v-else-if="interval === 'year'">
                    {{ t('billing.billedYearly', { amount: money(o.price.year) }) }}
                  </template>
                  <template v-else>{{ t('billing.billedMonthly') }}</template>
                </p>
                <button
                  class="pm-cta"
                  :class="ctaFor(o).tone"
                  :disabled="ctaFor(o).disabled"
                  @click="choose(o)"
                >
                  {{ ctaFor(o).label }}
                </button>
                <ul class="pm-limits">
                  <li v-for="k in LIMIT_KEYS" :key="k">
                    <b>{{ num(PLAN_LIMITS[o.id][k]) }}</b> {{ t('billing.limits.' + k) }}
                  </li>
                </ul>
                <ul class="pm-perks">
                  <li v-if="o.id === 'free'" class="pm-perk">
                    <UiIcon class="pm-perk-icon" name="sprout" :size="16" />
                    <span>{{ t('billing.freeIncludes') }}</span>
                  </li>
                  <li
                    v-for="p in o.perks"
                    :key="p"
                    class="pm-perk"
                    :class="{ soon: !PERKS[p].live }"
                  >
                    <UiIcon class="pm-perk-icon" :name="PERKS[p].icon" :size="16" />
                    <span>{{ t('billing.perks.' + p) }}</span>
                    <span v-if="!PERKS[p].live" class="pm-soon">{{ t('billing.soon') }}</span>
                  </li>
                </ul>
              </article>
            </div>

            <details class="pm-compare">
              <summary>{{ t('billing.compare') }}</summary>
              <table>
                <thead>
                  <tr>
                    <th></th>
                    <th v-for="o in PLAN_CATALOG" :key="o.id">
                      {{ t('billing.plans.' + o.id + '.name') }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="k in LIMIT_KEYS" :key="k">
                    <td>{{ t('billing.limits.' + k) }}</td>
                    <td v-for="o in PLAN_CATALOG" :key="o.id">{{ num(PLAN_LIMITS[o.id][k]) }}</td>
                  </tr>
                  <tr v-for="p in ALL_PERKS" :key="p">
                    <td>
                      <span class="pm-compare-perk">
                        <UiIcon :name="PERKS[p].icon" :size="14" />
                        {{ t('billing.perks.' + p) }}
                        <span v-if="!PERKS[p].live" class="pm-soon">{{ t('billing.soon') }}</span>
                      </span>
                    </td>
                    <td v-for="o in PLAN_CATALOG" :key="o.id" :class="{ yes: o.perks.includes(p) }">
                      <UiIcon
                        v-if="o.perks.includes(p)"
                        class="pm-compare-check"
                        name="check"
                        :size="16"
                        :stroke="2.6"
                      />
                      <template v-else>—</template>
                    </td>
                  </tr>
                </tbody>
              </table>
            </details>

            <section class="pm-faq">
              <h3>{{ t('billing.faqTitle') }}</h3>
              <details v-for="faqKey in FAQ" :key="faqKey">
                <summary>{{ t('billing.faq.' + faqKey + '.q') }}</summary>
                <p>{{ t('billing.faq.' + faqKey + '.a') }}</p>
              </details>
            </section>

            <p class="pm-fine">
              {{ t('billing.fine') }}
              <span v-if="provider === 'sandbox'" class="pm-sandbox-chip">
                <UiIcon name="flask-conical" :size="13" />
                {{ t('billing.sandboxChip') }}
              </span>
              <span v-else class="pm-sandbox-chip off">
                <UiIcon name="hourglass" :size="13" />
                {{ t('billing.notLiveChip') }}
              </span>
            </p>
          </div>

          <!-- ══ Step 2: review order ═══════════════════════════════════ -->
          <div v-else-if="step === 'review'" class="pm-scroll pm-narrow">
            <button class="pm-back" :disabled="busy" @click="step = 'plans'">
              <UiIcon name="arrow-left" :size="16" />
              {{ t('billing.backToPlans') }}
            </button>
            <h2 class="pm-title sm">{{ t('billing.reviewTitle') }}</h2>
            <div class="pm-order" :class="'tier-' + plan">
              <div class="pm-order-head">
                <PlanBadge :plan="plan" big />
                <div class="pm-interval mini" :class="interval" role="group">
                  <span class="pm-interval-thumb"></span>
                  <button :class="{ on: interval === 'month' }" @click="interval = 'month'">
                    {{ t('billing.monthly') }}
                  </button>
                  <button :class="{ on: interval === 'year' }" @click="interval = 'year'">
                    {{ t('billing.yearly') }}
                  </button>
                </div>
              </div>
              <ul class="pm-order-perks">
                <li v-for="p in livePerks(plan)" :key="p">
                  <UiIcon :name="PERKS[p].icon" :size="13" />
                  {{ t('billing.perks.' + p) }}
                </li>
              </ul>
              <form class="pm-coupon" @submit.prevent="applyCoupon">
                <input
                  v-model="couponInput"
                  :placeholder="t('billing.couponPh')"
                  maxlength="24"
                  spellcheck="false"
                  autocapitalize="characters"
                />
                <button class="pm-ghost" :disabled="!couponInput.trim() || busy">
                  {{ t('billing.apply') }}
                </button>
              </form>
              <p v-if="couponMsg" class="pm-coupon-msg" :class="couponMsg.tone">
                {{ couponMsg.text }}
              </p>
              <dl v-if="q" class="pm-lines">
                <div>
                  <dt>
                    {{ t('billing.plans.' + plan + '.name') }} ·
                    {{ interval === 'year' ? t('billing.yearly') : t('billing.monthly') }}
                  </dt>
                  <dd>{{ money(q.subtotal) }}</dd>
                </div>
                <div v-if="q.discount" class="disc">
                  <dt class="pm-coupon-line">
                    <UiIcon name="ticket" :size="14" />
                    {{ q.coupon }}
                  </dt>
                  <dd>−{{ money(q.discount) }}</dd>
                </div>
                <div v-if="q.annualSavings" class="save">
                  <dt>{{ t('billing.annualSavings') }}</dt>
                  <dd>{{ money(q.annualSavings) }}</dd>
                </div>
                <div class="total">
                  <dt>{{ t('billing.dueToday') }}</dt>
                  <dd>{{ money(q.total) }}</dd>
                </div>
              </dl>
              <p class="pm-renew">
                {{ t('billing.renews', { date: renewDate, amount: money(q?.subtotal ?? 0) }) }}
              </p>
            </div>

            <label class="pm-agree">
              <input v-model="agree" type="checkbox" />
              <span>{{ t('billing.agree') }}</span>
            </label>
            <p v-if="error" class="pm-error">{{ error }}</p>

            <button
              v-if="provider === 'sandbox'"
              class="pm-cta primary wide"
              :disabled="!agree || busy || !q"
              @click="checkout"
            >
              <span v-if="busy" class="pm-spin"></span>
              <UiIcon v-else name="lock" :size="16" />
              {{ t('billing.continue') }}
            </button>
            <template v-else>
              <button
                class="pm-cta primary wide"
                :disabled="waitlisted === plan"
                @click="joinWaitlist"
              >
                <UiIcon :name="waitlisted === plan ? 'check' : 'bell'" :size="16" />
                {{ waitlisted === plan ? t('billing.waitlisted') : t('billing.notifyMe') }}
              </button>
              <p class="pm-muted center">{{ t('billing.notLiveBody') }}</p>
            </template>
            <p class="pm-secure">
              <UiIcon name="shield-check" :size="14" />
              <span>{{ t('billing.secureNote') }}</span>
            </p>
          </div>

          <!-- ══ Step 3: the payment partner (sandbox stand-in) ══════════ -->
          <div v-else-if="step === 'provider'" class="pm-scroll pm-narrow">
            <div class="pm-provider">
              <div class="pm-provider-ribbon">SANDBOX · {{ t('billing.sandboxRibbon') }}</div>
              <template v-if="processing">
                <div class="pm-processing">
                  <span class="pm-spin big"></span>
                  <p>{{ t('billing.contacting') }}</p>
                </div>
              </template>
              <template v-else>
                <p class="pm-provider-brand">
                  <UiIcon name="flask-conical" :size="16" />
                  {{ t('billing.sandboxBrand') }}
                </p>
                <p class="pm-provider-amount">{{ money(checkoutSession?.quote.total ?? 0) }}</p>
                <p class="pm-muted center">
                  {{ t('billing.plans.' + plan + '.name') }} ·
                  {{ interval === 'year' ? t('billing.yearly') : t('billing.monthly') }}
                </p>
                <p class="pm-provider-note">{{ t('billing.sandboxBody') }}</p>
                <div class="pm-provider-actions">
                  <button class="pm-cta primary wide" :disabled="busy" @click="finish('success')">
                    <UiIcon name="check" :size="16" />
                    {{ t('billing.simSuccess') }}
                  </button>
                  <button class="pm-cta danger wide" :disabled="busy" @click="finish('fail')">
                    <UiIcon name="x" :size="16" />
                    {{ t('billing.simFail') }}
                  </button>
                  <button class="pm-ghost wide" :disabled="busy" @click="finish('cancel')">
                    <UiIcon name="undo-2" :size="16" />
                    {{ t('billing.simCancel') }}
                  </button>
                </div>
              </template>
            </div>
          </div>

          <!-- ══ Step 4a: welcome ═══════════════════════════════════════ -->
          <div v-else-if="step === 'done'" class="pm-scroll pm-narrow pm-done">
            <div class="pm-confetti" aria-hidden="true">
              <i v-for="n in 36" :key="n" :style="confettiStyle(n)"></i>
            </div>
            <div class="pm-done-badge" :class="'tier-' + plan">
              <UiIcon :name="plan === 'pro' ? 'gem' : 'sparkles'" :size="40" :stroke="1.8" />
            </div>
            <h2 class="pm-title sm">
              {{ t('billing.welcome', { plan: t('billing.plans.' + plan + '.name') }) }}
            </h2>
            <p class="pm-sub">{{ t('billing.welcomeBody') }}</p>
            <ul class="pm-unlocked">
              <li v-for="(p, i) in livePerks(plan)" :key="p" :style="{ '--i': i }">
                <UiIcon :name="PERKS[p].icon" :size="14" />
                {{ t('billing.perks.' + p) }}
              </li>
            </ul>
            <button class="pm-cta primary wide" @click="close">
              {{ t('billing.startExploring') }}
            </button>
          </div>

          <!-- ══ Step 4b: declined ══════════════════════════════════════ -->
          <div v-else-if="step === 'failed'" class="pm-scroll pm-narrow pm-done">
            <div class="pm-done-badge failed">
              <UiIcon name="circle-alert" :size="40" :stroke="1.8" />
            </div>
            <h2 class="pm-title sm">{{ t('billing.declined') }}</h2>
            <p class="pm-sub">{{ t('billing.declinedBody') }}</p>
            <button class="pm-cta primary wide" @click="step = 'review'">
              {{ t('billing.tryAgain') }}
            </button>
            <button class="pm-ghost wide" @click="close">{{ t('billing.close') }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useMainStore } from '../../store/index.js'
import { useI18n } from '../../i18n'
import { toast } from '../../lib/dialogs.js'
import PlanBadge from './PlanBadge.vue'
import UiIcon from '../ui/UiIcon.js'
import {
  PERKS,
  PLAN_CATALOG,
  addInterval,
  offerFor,
  quote as localQuote
} from '../../../../shared/billing'
import { PLAN_LIMITS } from '../../../../shared/auth'

const store = useMainStore()
const { t, locale } = useI18n()

const LIMIT_KEYS = ['maxProjects', 'maxPersons', 'maxImages']
const FAQ = ['cancel', 'downgrade', 'secure', 'discounts']
const ALL_PERKS = Object.keys(PERKS)

const step = ref('plans')
const interval = ref('year')
const plan = ref('plus')
const preselect = ref(null)
const couponInput = ref('')
const appliedCoupon = ref('')
const couponMsg = ref(null)
const q = ref(null)
const agree = ref(false)
const busy = ref(false)
const processing = ref(false)
const error = ref('')
const checkoutSession = ref(null)
const waitlisted = ref(readWaitlist())

const provider = computed(() => store.billingCatalog?.provider ?? 'none')
const currentPlan = computed(() => store.authUser?.plan || 'free')
const currentSub = computed(() => store.billingStatus?.subscription ?? null)
const yearlyPct = computed(() => {
  const o = offerFor('plus')
  return Math.round((1 - o.price.year / (o.price.month * 12)) * 100)
})

// Why the plans opened (quota hit, ad dismissed, locked feature) — icon + text.
const reason = computed(() => {
  const ctx = store.pricingContext || {}
  if (ctx.reason === 'quota') {
    // "Free plan limit reached: 10 projects" → "10 projects"
    const detail = String(ctx.detail || '').replace(/^.*limit reached:\s*/i, '')
    return {
      icon: 'triangle-alert',
      text: `${t('billing.reason.quota')}${detail ? ' · ' + detail : ''}`
    }
  }
  if (ctx.reason === 'ads') return { icon: 'ban', text: t('billing.reason.ads') }
  if (ctx.reason === 'feature') return { icon: 'lock', text: t('billing.reason.feature') }
  return null
})

// ── Formatting ───────────────────────────────────────────────────────────────
function money(cents, currency = 'USD') {
  return new Intl.NumberFormat(locale.value, { style: 'currency', currency }).format(cents / 100)
}
function num(n) {
  return new Intl.NumberFormat(locale.value, {
    notation: n >= 100000 ? 'compact' : 'standard'
  }).format(n)
}
function perMonth(o) {
  const cents = interval.value === 'year' ? o.price.year / 12 : o.price.month
  return money(Math.round(cents))
}
const renewDate = computed(() => {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const end = addInterval(now, interval.value)
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'long' }).format(
    new Date(end.replace(' ', 'T') + 'Z')
  )
})
function livePerks(id) {
  return offerFor(id).perks.filter((p) => PERKS[p].live)
}

// ── Plan cards ───────────────────────────────────────────────────────────────
function isCurrent(o) {
  if (o.id !== currentPlan.value) return false
  return o.id === 'free' || !currentSub.value || currentSub.value.interval === interval.value
}
function ctaFor(o) {
  if (store.isGuest) return { label: t('billing.cta.guest'), disabled: true, tone: '' }
  if (o.id === 'free') {
    return currentPlan.value === 'free'
      ? { label: t('billing.cta.current'), disabled: true, tone: '' }
      : { label: t('billing.cta.included'), disabled: true, tone: '' }
  }
  if (isCurrent(o)) return { label: t('billing.cta.current'), disabled: true, tone: '' }
  const name = t('billing.plans.' + o.id + '.name')
  if (o.id === currentPlan.value)
    return { label: t('billing.cta.switchInterval'), disabled: false, tone: 'primary' }
  const up = o.rank > offerFor(currentPlan.value).rank
  return {
    label: t(up ? 'billing.cta.upgrade' : 'billing.cta.switch', { plan: name }),
    disabled: false,
    tone: up ? 'primary' : ''
  }
}
function choose(o) {
  plan.value = o.id
  error.value = ''
  agree.value = false
  step.value = 'review'
}

// ── Review ───────────────────────────────────────────────────────────────────
// The server prices the order (real promo codes will live at the payment
// provider); the shared catalog is only a fallback when billing is unreachable.
async function refreshQuote() {
  if (step.value !== 'review') return
  const res = await store.quoteBilling(plan.value, interval.value, appliedCoupon.value)
  q.value = res.success ? res.data : localQuote(plan.value, interval.value, appliedCoupon.value)
  const err = q.value.couponError
  if (appliedCoupon.value) {
    couponMsg.value = err
      ? { tone: 'bad', text: t('billing.couponErr.' + err) }
      : { tone: 'good', text: t('billing.couponOk', { code: q.value.coupon }) }
    if (err) appliedCoupon.value = ''
  }
}
watch([step, plan, interval], refreshQuote)
function applyCoupon() {
  appliedCoupon.value = couponInput.value.trim()
  refreshQuote()
}

async function checkout() {
  busy.value = true
  error.value = ''
  const res = await store.startCheckout(plan.value, interval.value, appliedCoupon.value)
  busy.value = false
  if (!res.success) {
    error.value = res.error
    return
  }
  checkoutSession.value = res.data
  // A real provider returns a hosted-checkout URL to open here (see
  // docs/MONETIZATION.md); the sandbox renders its stand-in instead.
  step.value = 'provider'
  processing.value = true
  setTimeout(() => (processing.value = false), 900)
}

async function finish(outcome) {
  if (!checkoutSession.value) return
  busy.value = true
  const res = await store.completeSandboxCheckout(checkoutSession.value.id, outcome)
  busy.value = false
  checkoutSession.value = null
  if (!res.success) {
    error.value = res.error
    step.value = 'review'
    return
  }
  if (outcome === 'success') step.value = 'done'
  else if (outcome === 'fail') step.value = 'failed'
  else step.value = 'review'
}

// Payments not live: remember the interest on this device only (nothing is
// sent anywhere) so the reminder can show once checkout opens.
function readWaitlist() {
  try {
    return localStorage.getItem('billing:waitlist') || ''
  } catch {
    return ''
  }
}
function joinWaitlist() {
  try {
    localStorage.setItem('billing:waitlist', plan.value)
  } catch {
    /* ignore */
  }
  waitlisted.value = plan.value
  toast(t('billing.waitlistToast'), { tone: 'success', icon: 'bell' })
}

function confettiStyle(n) {
  const r = (k) => ((Math.sin(n * 91.7 + k * 17.3) + 1) / 2) % 1
  return {
    left: `${(r(1) * 100).toFixed(1)}%`,
    background: ['var(--accent)', 'var(--accent-2)', 'var(--amber)', 'var(--pink)', 'var(--green)'][
      n % 5
    ],
    animationDelay: `${(r(2) * 0.6).toFixed(2)}s`,
    animationDuration: `${(1.6 + r(3) * 1.4).toFixed(2)}s`,
    transform: `rotate(${Math.round(r(4) * 360)}deg)`
  }
}

// ── Open / close ─────────────────────────────────────────────────────────────
watch(
  () => store.pricingOpen,
  (open) => {
    if (!open) return
    const ctx = store.pricingContext || {}
    step.value = 'plans'
    error.value = ''
    couponInput.value = ''
    appliedCoupon.value = ''
    couponMsg.value = null
    agree.value = false
    preselect.value = ctx.plan || null
    if (currentSub.value) interval.value = currentSub.value.interval
    store.loadBilling()
  }
)
function close() {
  if (busy.value) return
  store.closePricing()
}
function onKey(e) {
  if (store.pricingOpen && e.key === 'Escape') {
    e.stopPropagation()
    close()
  }
}
onMounted(() => window.addEventListener('keydown', onKey, true))
onUnmounted(() => window.removeEventListener('keydown', onKey, true))
</script>

<style scoped>
.pm-backdrop {
  position: fixed;
  inset: 0;
  z-index: 290;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(6, 8, 16, 0.6);
  backdrop-filter: blur(8px);
}
.pm-panel {
  position: relative;
  width: min(1100px, 100%);
  max-height: min(94vh, 1000px);
  display: flex;
  flex-direction: column;
  border-radius: var(--r-xl);
  background: var(--bg);
  border: 1px solid var(--border-strong);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}
.pm-close {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--ctl-md);
  height: var(--ctl-md);
  padding: 0;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--t2);
  cursor: pointer;
}
.pm-close:hover:not(:disabled) {
  color: var(--t1);
  background: var(--hover);
}
.pm-scroll {
  position: relative;
  overflow-y: auto;
  padding: 34px 32px 26px;
}
.pm-narrow {
  width: min(520px, 100%);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* ── Head ─────────────────────────────────────────────────────────────────── */
.pm-sparkles .ui-icon {
  position: absolute;
  top: calc(4% + (var(--n) * 37 % 30) * 1%);
  left: calc(var(--n) * 8%);
  color: var(--accent);
  opacity: 0.25;
  animation: pm-twinkle 3.4s ease-in-out infinite;
  animation-delay: calc(var(--n) * -0.4s);
  pointer-events: none;
}
@keyframes pm-twinkle {
  50% {
    opacity: 0.7;
    transform: translateY(-6px) scale(1.3);
  }
}
.pm-head {
  position: relative;
  text-align: center;
}
.pm-reason {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin: 0 0 12px;
  padding: 6px 14px;
  border-radius: var(--r-pill);
  font-size: 13px;
  font-weight: 700;
  color: var(--t1);
  background: rgba(var(--accent-rgb), 0.12);
  border: 1px solid rgba(var(--accent-rgb), 0.35);
}
.pm-eyebrow {
  margin: 0;
  font-size: 12.5px;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--accent);
}
.pm-title {
  margin: 6px 0 0;
  font-size: clamp(26px, 4vw, 40px);
  font-weight: 900;
  letter-spacing: -0.02em;
  color: var(--t1);
}
.pm-title.sm {
  font-size: 24px;
  margin: 0;
}
.pm-sub {
  margin: 8px auto 0;
  max-width: 560px;
  color: var(--t2);
  font-size: 14px;
  line-height: 1.6;
}
.pm-interval {
  position: relative;
  display: inline-grid;
  grid-template-columns: 1fr 1fr;
  margin-top: 18px;
  padding: 4px;
  border-radius: var(--r-pill);
  background: var(--elevated);
  border: 1px solid var(--border);
}
.pm-interval button {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 18px;
  border: none;
  background: none;
  color: var(--t2);
  font-weight: 800;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
}
.pm-interval button.on {
  color: var(--t1);
}
.pm-interval-thumb {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 4px;
  width: calc(50% - 4px);
  border-radius: var(--r-pill);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  transition: transform 0.35s var(--ease-spring);
}
.pm-interval.year .pm-interval-thumb {
  transform: translateX(100%);
}
.pm-interval.mini {
  margin: 0;
}
.pm-interval.mini button {
  padding: 5px 12px;
  font-size: 12.5px;
}
.pm-save {
  padding: 1px 7px;
  border-radius: var(--r-pill);
  font-size: 11.5px;
  color: #fff;
  background: var(--green);
}

/* ── Cards ────────────────────────────────────────────────────────────────── */
.pm-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-top: 26px;
}
.pm-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 22px 20px 20px;
  border-radius: var(--r-xl);
  background: var(--surface);
  border: 1px solid var(--border);
  animation: pm-rise 0.5s var(--ease-out) both;
  animation-delay: calc(var(--i) * 80ms);
  transition:
    transform 0.3s var(--ease-out),
    box-shadow 0.3s ease;
}
@keyframes pm-rise {
  from {
    opacity: 0;
    transform: translateY(18px);
  }
}
.pm-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}
.pm-card.featured {
  border: 1.5px solid rgba(var(--accent-rgb), 0.6);
  box-shadow: var(--glow);
  background:
    radial-gradient(120% 60% at 50% 0%, rgba(var(--accent-rgb), 0.12), transparent 70%),
    var(--surface);
}
/* Pro: a slowly turning gold rim (gradient border: the card's surface on the
   padding box, the conic gradient on the border box) */
.pm-card.tier-pro {
  border: 1.5px solid transparent;
  background:
    linear-gradient(var(--surface), var(--surface)) padding-box,
    conic-gradient(from var(--pm-a), #ffe27a, #ff8fb1, #b07cf5, #7cc7ff, #ffe27a) border-box;
  animation:
    pm-rise 0.5s var(--ease-out) both,
    pm-spin 6s linear infinite;
  animation-delay: calc(var(--i) * 80ms), 0s;
}
@property --pm-a {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}
@keyframes pm-spin {
  to {
    --pm-a: 360deg;
  }
}
.pm-card.current {
  border-style: dashed;
}
.pm-card.pulse {
  animation:
    pm-rise 0.5s var(--ease-out) both,
    pm-pulse 1.4s ease-in-out 0.6s 2;
}
@keyframes pm-pulse {
  50% {
    box-shadow: 0 0 0 6px rgba(var(--accent-rgb), 0.25);
  }
}
.pm-ribbon {
  position: absolute;
  top: -11px;
  left: 50%;
  transform: translateX(-50%);
  padding: 3px 12px;
  border-radius: var(--r-pill);
  font-size: 12px;
  font-weight: 900;
  color: var(--on-accent);
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  white-space: nowrap;
}
.pm-card-head {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}
.pm-tagline {
  margin: 0;
  font-size: 13px;
  color: var(--t2);
  min-height: 2.8em;
  line-height: 1.4;
}
.pm-price {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.pm-amount {
  display: inline-block;
  font-size: 36px;
  font-weight: 900;
  letter-spacing: -0.02em;
  color: var(--t1);
}
.pm-per {
  font-size: 13px;
  color: var(--t2);
}
.pm-num-enter-active,
.pm-num-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.22s var(--ease-out);
}
.pm-num-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.pm-num-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
.pm-billed {
  margin: -6px 0 0;
  font-size: 12.5px;
  color: var(--t3);
  min-height: 1.4em;
}
.pm-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: var(--ctl-lg);
  padding: 0 16px;
  border-radius: var(--r-md);
  border: 1px solid var(--border-strong);
  background: var(--elevated);
  color: var(--t1);
  font-weight: 800;
  font-size: 13.5px;
  cursor: pointer;
  transition:
    transform 0.2s var(--ease-spring),
    filter 0.2s ease;
}
.pm-cta:hover:not(:disabled) {
  transform: translateY(-1px);
}
.pm-cta:disabled {
  opacity: 0.55;
  cursor: default;
}
.pm-cta.primary {
  border-color: transparent;
  color: var(--on-accent);
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  box-shadow: var(--glow);
}
.pm-cta.primary:hover:not(:disabled) {
  filter: brightness(1.08);
}
.pm-cta.danger {
  border-color: rgba(var(--danger-rgb), 0.5);
  background: rgba(var(--danger-rgb), 0.12);
  color: var(--danger);
}
.pm-cta.wide,
.pm-ghost.wide {
  width: 100%;
}
.pm-ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: var(--ctl-lg);
  padding: 0 14px;
  border-radius: var(--r-md);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--t2);
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
}
.pm-ghost:hover:not(:disabled) {
  color: var(--t1);
  background: var(--hover);
}
.pm-limits,
.pm-perks {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--t2);
}
.pm-limits {
  padding: 10px 0;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}
.pm-limits b {
  color: var(--t1);
}
.pm-perk {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--t1);
}
.pm-perk.soon {
  color: var(--t3);
}
.pm-perk-icon {
  flex-shrink: 0;
  color: var(--accent);
}
.pm-perk.soon .pm-perk-icon {
  color: var(--t3);
}
.pm-soon {
  margin-left: auto;
  padding: 1px 6px;
  border-radius: var(--r-xs);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--amber);
  background: rgba(245, 166, 35, 0.14);
}

/* ── Compare / FAQ / fine print ───────────────────────────────────────────── */
.pm-compare,
.pm-faq details {
  margin-top: 22px;
  border-radius: var(--r-lg);
  border: 1px solid var(--border);
  background: var(--surface);
}
.pm-compare summary,
.pm-faq summary {
  padding: 12px 16px;
  cursor: pointer;
  font-weight: 800;
  font-size: 13.5px;
  color: var(--t1);
}
.pm-compare table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.pm-compare th,
.pm-compare td {
  padding: 8px 14px;
  text-align: center;
  border-top: 1px solid var(--border);
  color: var(--t2);
}
.pm-compare th:first-child,
.pm-compare td:first-child {
  text-align: left;
  color: var(--t1);
}
.pm-compare td.yes {
  color: var(--green);
  font-weight: 900;
}
.pm-compare-check {
  display: inline-block;
  vertical-align: middle;
}
.pm-compare-perk {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.pm-compare-perk .ui-icon {
  flex-shrink: 0;
  color: var(--t3);
}
.pm-coupon-line {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.pm-compare .pm-soon {
  margin-left: 6px;
}
.pm-faq {
  margin-top: 26px;
}
.pm-faq h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 900;
  color: var(--t1);
}
.pm-faq details {
  margin-top: 8px;
}
.pm-faq p {
  margin: 0;
  padding: 0 16px 14px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--t2);
}
.pm-fine {
  margin: 20px 0 0;
  text-align: center;
  font-size: 12.5px;
  color: var(--t3);
}
.pm-sandbox-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  vertical-align: middle;
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: var(--r-pill);
  font-weight: 800;
  color: var(--amber);
  background: rgba(245, 166, 35, 0.14);
}
.pm-sandbox-chip.off {
  color: var(--t2);
  background: var(--elevated);
}

/* ── Review ───────────────────────────────────────────────────────────────── */
.pm-back {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: none;
  color: var(--t2);
  font-weight: 700;
  cursor: pointer;
  padding: 0;
}
.pm-back:hover {
  color: var(--accent);
}
.pm-order {
  padding: 18px;
  border-radius: var(--r-lg);
  background: var(--surface);
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.pm-order-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.pm-order-perks {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 12.5px;
}
.pm-order-perks li {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: var(--r-pill);
  background: var(--elevated);
  color: var(--t1);
}
.pm-coupon {
  display: flex;
  gap: 8px;
}
.pm-coupon input {
  flex: 1;
  min-width: 0;
  padding: 9px 12px;
  border-radius: var(--r-md);
  border: 1px solid var(--border);
  background: var(--elevated);
  color: var(--t1);
  font-family: var(--mono);
  text-transform: uppercase;
  outline: none;
}
.pm-coupon input:focus {
  border-color: var(--accent);
  box-shadow: var(--focus-ring);
}
.pm-coupon-msg {
  margin: -4px 0 0;
  font-size: 12.5px;
  font-weight: 700;
}
.pm-coupon-msg.good {
  color: var(--green);
}
.pm-coupon-msg.bad {
  color: var(--danger);
}
.pm-lines {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
}
.pm-lines div {
  display: flex;
  justify-content: space-between;
  color: var(--t2);
}
.pm-lines dt,
.pm-lines dd {
  margin: 0;
}
.pm-lines .disc,
.pm-lines .save {
  color: var(--green);
}
.pm-lines .total {
  padding-top: 8px;
  border-top: 1px solid var(--border);
  font-size: 16px;
  font-weight: 900;
  color: var(--t1);
}
.pm-renew {
  margin: 0;
  font-size: 12.5px;
  color: var(--t3);
}
.pm-agree {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  font-size: 13px;
  color: var(--t2);
  cursor: pointer;
}
.pm-error {
  margin: 0;
  color: var(--danger);
  font-size: 13px;
  font-weight: 700;
}
.pm-muted {
  margin: 0;
  font-size: 12.5px;
  color: var(--t2);
  line-height: 1.5;
}
.center {
  text-align: center;
}
.pm-secure {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin: 0;
  text-align: center;
  font-size: 12.5px;
  color: var(--t3);
}
.pm-spin {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid currentColor;
  border-right-color: transparent;
  animation: pm-rot 0.7s linear infinite;
}
.pm-spin.big {
  width: 38px;
  height: 38px;
  border-width: 3px;
  color: var(--accent);
}
@keyframes pm-rot {
  to {
    transform: rotate(360deg);
  }
}

/* ── Provider (sandbox) ───────────────────────────────────────────────────── */
.pm-provider {
  position: relative;
  padding: 44px 24px 24px;
  border-radius: var(--r-lg);
  border: 2px dashed rgba(245, 166, 35, 0.6);
  background:
    repeating-linear-gradient(-45deg, rgba(245, 166, 35, 0.05) 0 12px, transparent 12px 24px),
    var(--surface);
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: hidden;
}
.pm-provider-ribbon {
  position: absolute;
  inset: 0 0 auto 0;
  padding: 6px;
  text-align: center;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.1em;
  color: #1a1d2e;
  background: var(--amber);
}
.pm-provider-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  margin: 0;
  text-align: center;
  font-weight: 900;
  color: var(--t1);
}
.pm-provider-amount {
  margin: 0;
  text-align: center;
  font-size: 38px;
  font-weight: 900;
  color: var(--t1);
}
.pm-provider-note {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--t2);
  text-align: center;
}
.pm-provider-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}
.pm-processing {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 0;
  color: var(--t2);
}

/* ── Done / failed ────────────────────────────────────────────────────────── */
.pm-done {
  align-items: center;
  text-align: center;
  padding-top: 44px;
}
.pm-confetti {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}
.pm-confetti i {
  position: absolute;
  top: -12px;
  width: 8px;
  height: 12px;
  border-radius: 2px;
  animation: pm-fall 2s var(--ease-out) forwards;
}
@keyframes pm-fall {
  to {
    top: 105%;
    transform: rotate(540deg) translateX(30px);
    opacity: 0;
  }
}
.pm-done-badge {
  width: 84px;
  height: 84px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--on-accent);
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  box-shadow: var(--glow);
  animation: pm-bounce 0.8s var(--ease-spring);
}
.pm-done-badge.tier-pro {
  color: #1a1d2e;
  background: linear-gradient(135deg, #ffe27a, #ff8fb1);
}
.pm-done-badge.failed {
  color: #fff;
  background: var(--danger);
  box-shadow: none;
}
@keyframes pm-bounce {
  from {
    transform: scale(0.3) rotate(-30deg);
  }
}
.pm-unlocked {
  list-style: none;
  margin: 4px 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}
.pm-unlocked li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--r-pill);
  font-size: 13px;
  font-weight: 700;
  color: var(--t1);
  background: var(--adim);
  animation: pm-rise 0.45s var(--ease-out) both;
  animation-delay: calc(0.3s + var(--i) * 80ms);
}

/* ── Transitions & responsive ─────────────────────────────────────────────── */
.pm-enter-active,
.pm-leave-active {
  transition: opacity 0.25s ease;
}
.pm-enter-active .pm-panel,
.pm-leave-active .pm-panel {
  transition: transform 0.35s var(--ease-out);
}
.pm-enter-from,
.pm-leave-to {
  opacity: 0;
}
.pm-enter-from .pm-panel {
  transform: translateY(30px) scale(0.97);
}

@media (max-width: 860px) {
  .pm-backdrop {
    padding: 0;
  }
  .pm-panel {
    max-height: 100vh;
    height: 100vh;
    border-radius: 0;
  }
  .pm-cards {
    grid-template-columns: 1fr;
  }
  .pm-scroll {
    padding: 28px 16px 20px;
  }
  .pm-compare {
    overflow-x: auto;
  }
}
@media (prefers-reduced-motion: reduce) {
  .pm-sparkles span,
  .pm-card,
  .pm-confetti i,
  .pm-unlocked li {
    animation: none;
  }
}
</style>
