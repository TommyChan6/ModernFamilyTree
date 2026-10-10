// Monetization core — platform-free, shared by every backend.
//
// What's here is the CLIENT-FACING CONTRACT for premium plans: the plan
// catalog (prices, limits, perks), price quotes, the subscription/invoice
// shapes, and the billing:* channels the renderer talks to.
//
// No money moves anywhere in this codebase. Real payments need a payment
// provider (Stripe / Paddle / Lemon Squeezy — all need card or bank details,
// so they wait until the zero-cost rule is lifted). Until then the channels run
// a SANDBOX provider: checkout sessions complete only through an explicit
// "simulate" call, and only when the shell enables it (env.billingSandbox —
// dev builds). With the sandbox off, checkout refuses with "payments aren't
// live yet". Production wiring is specified in docs/MONETIZATION.md.

import type { AuthCtx, DB, Env, User } from './types'
import { PLAN_LIMITS } from './auth'

// ── Catalog ──────────────────────────────────────────────────────────────────
export type PaidPlan = 'plus' | 'pro'
export type PlanId = 'free' | PaidPlan
export type BillingInterval = 'month' | 'year'

/** A perk shown on the pricing cards. `live` perks work today; the rest are
 *  roadmap items shown as "coming soon" (never sold as if they exist). */
export type PerkKey =
  | 'adFree'
  | 'moreProjects'
  | 'morePeople'
  | 'morePhotos'
  | 'supporterBadge'
  | 'earlyLabs'
  | 'coEdit'
  | 'hiresExport'
  | 'gedcom'
  | 'aiCredits'
  | 'prioritySupport'

/** `icon` is a UiIcon name (renderer: components/ui/icons.js). */
export const PERKS: Record<PerkKey, { live: boolean; icon: string }> = {
  adFree: { live: true, icon: 'ban' },
  moreProjects: { live: true, icon: 'folder-plus' },
  morePeople: { live: true, icon: 'users' },
  morePhotos: { live: true, icon: 'images' },
  supporterBadge: { live: true, icon: 'sparkles' },
  earlyLabs: { live: true, icon: 'flask-conical' },
  coEdit: { live: false, icon: 'handshake' },
  hiresExport: { live: false, icon: 'printer' },
  gedcom: { live: false, icon: 'dna' },
  aiCredits: { live: false, icon: 'wand-sparkles' },
  prioritySupport: { live: false, icon: 'message-circle' }
}

export interface PlanOffer {
  id: PlanId
  /** Ordering for upgrade/downgrade comparisons. */
  rank: number
  /** Price in minor units (cents) per billing interval. */
  price: Record<BillingInterval, number>
  currency: 'USD'
  perks: PerkKey[]
  /** The card the pricing page nudges toward. */
  featured?: boolean
}

export const PLAN_CATALOG: PlanOffer[] = [
  {
    id: 'free',
    rank: 0,
    price: { month: 0, year: 0 },
    currency: 'USD',
    perks: []
  },
  {
    id: 'plus',
    rank: 1,
    price: { month: 400, year: 3600 },
    currency: 'USD',
    perks: ['adFree', 'moreProjects', 'morePeople', 'morePhotos', 'supporterBadge', 'coEdit'],
    featured: true
  },
  {
    id: 'pro',
    rank: 2,
    price: { month: 900, year: 8100 },
    currency: 'USD',
    perks: [
      'adFree',
      'moreProjects',
      'morePeople',
      'morePhotos',
      'supporterBadge',
      'earlyLabs',
      'coEdit',
      'hiresExport',
      'gedcom',
      'aiCredits',
      'prioritySupport'
    ]
  }
]

export function offerFor(plan: string | null | undefined): PlanOffer {
  return PLAN_CATALOG.find((o) => o.id === plan) || PLAN_CATALOG[0]
}

export function isPaidPlan(plan: string | null | undefined): plan is PaidPlan {
  return plan === 'plus' || plan === 'pro'
}

/** Plan-level perk check (ads, badges). Guests and unknown plans = free. */
export function planHasPerk(plan: string | null | undefined, perk: PerkKey): boolean {
  return offerFor(plan).perks.includes(perk)
}

// ── Coupons ──────────────────────────────────────────────────────────────────
// Sandbox codes so the checkout UI has something to exercise. The real list
// lives in the payment provider (docs/MONETIZATION.md) — never trust a
// client-side discount.
export interface Coupon {
  code: string
  percentOff: number
  /** Restrict to one interval (e.g. an annual-only launch deal). */
  interval?: BillingInterval
}
export const SANDBOX_COUPONS: Coupon[] = [
  { code: 'FOREST20', percentOff: 20 },
  { code: 'EARLYBIRD', percentOff: 50, interval: 'year' },
  { code: 'GRAFT10', percentOff: 10 }
]

export function findCoupon(code: string | null | undefined): Coupon | null {
  const c = String(code || '')
    .trim()
    .toUpperCase()
  return c ? SANDBOX_COUPONS.find((k) => k.code === c) || null : null
}

// ── Quotes ───────────────────────────────────────────────────────────────────
export interface Quote {
  plan: PaidPlan
  interval: BillingInterval
  currency: 'USD'
  subtotal: number
  discount: number
  total: number
  /** What a year of monthly billing would cost minus this (annual only). */
  annualSavings: number
  coupon: string | null
  /** Why a supplied code didn't apply (null when fine or none given). */
  couponError: 'unknown' | 'interval' | null
}

export function quote(
  plan: PaidPlan,
  interval: BillingInterval,
  couponCode?: string | null
): Quote {
  const offer = offerFor(plan)
  if (offer.id === 'free') throw new Error('Unknown plan')
  const subtotal = offer.price[interval]
  let coupon: Coupon | null = null
  let couponError: Quote['couponError'] = null
  if (couponCode && String(couponCode).trim()) {
    coupon = findCoupon(couponCode)
    if (!coupon) couponError = 'unknown'
    else if (coupon.interval && coupon.interval !== interval) {
      couponError = 'interval'
      coupon = null
    }
  }
  const discount = coupon ? Math.round((subtotal * coupon.percentOff) / 100) : 0
  return {
    plan,
    interval,
    currency: offer.currency,
    subtotal,
    discount,
    total: subtotal - discount,
    annualSavings: interval === 'year' ? offer.price.month * 12 - offer.price.year : 0,
    coupon: coupon?.code ?? null,
    couponError
  }
}

// ── Records ──────────────────────────────────────────────────────────────────
export type SubscriptionStatus = 'active' | 'canceled'

/** One per user. Mirrors what a provider webhook would keep in sync. */
export interface Subscription {
  user_id: string
  plan: PaidPlan
  interval: BillingInterval
  status: SubscriptionStatus
  current_period_start: string
  current_period_end: string
  /** Canceled but still paid up — reverts to free at period end. */
  cancel_at_period_end: boolean
  provider: 'sandbox'
  /** The provider's subscription id (null in the sandbox). */
  provider_ref: string | null
  created_at: string
  updated_at: string
}

export interface CheckoutSession {
  id: string
  user_id: string
  plan: PaidPlan
  interval: BillingInterval
  quote: Quote
  status: 'open' | 'complete' | 'failed' | 'canceled'
  /** Where a real provider's hosted checkout lives (null in the sandbox). */
  url: string | null
  created_at: string
}

export interface Invoice {
  id: string
  user_id: string
  number: string
  plan: PaidPlan
  interval: BillingInterval
  amount: number
  currency: 'USD'
  status: 'paid' | 'failed'
  created_at: string
}

export interface BillingStore {
  subscriptions: Record<string, Subscription>
  checkouts: Record<string, CheckoutSession>
  invoices: Record<string, Invoice>
}

export const EMPTY_BILLING = (): BillingStore => ({
  subscriptions: {},
  checkouts: {},
  invoices: {}
})

function billingOf(db: DB): BillingStore {
  if (!db.billing) db.billing = EMPTY_BILLING()
  return db.billing
}

// ── Dates (nowStr format: "YYYY-MM-DD HH:MM:SS", UTC) ────────────────────────
const toDate = (s: string) => new Date(s.replace(' ', 'T') + 'Z')
const fromDate = (d: Date) => d.toISOString().replace('T', ' ').slice(0, 19)

export function addInterval(start: string, interval: BillingInterval): string {
  const d = toDate(start)
  if (interval === 'year') d.setUTCFullYear(d.getUTCFullYear() + 1)
  else d.setUTCMonth(d.getUTCMonth() + 1)
  return fromDate(d)
}

/**
 * Bring a user's plan in line with their subscription at `now`: a canceled
 * subscription past its period end reverts them to free. (A real backend does
 * this on the provider's `subscription.deleted` webhook; the sandbox has no
 * webhooks, so status reads settle it.) Returns true when anything changed.
 */
export function settleSubscription(db: DB, user: User, now: string): boolean {
  const sub = billingOf(db).subscriptions[user.id]
  if (!sub || sub.status !== 'active') return false
  if (sub.current_period_end > now) return false
  if (sub.cancel_at_period_end) {
    sub.status = 'canceled'
    sub.updated_at = now
    if (isPaidPlan(user.plan)) user.plan = 'free'
    return true
  }
  // Sandbox auto-renewal: roll the period forward (a real provider charges
  // and sends `invoice.paid`; the sandbox just keeps the plan).
  sub.current_period_start = sub.current_period_end
  sub.current_period_end = addInterval(sub.current_period_start, sub.interval)
  sub.updated_at = now
  return true
}

// ── Channels ─────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (db: DB, data: any, env: Env, ctx?: AuthCtx) => unknown

function requireBuyer(ctx?: AuthCtx): User {
  const user = ctx?.user
  if (!user) throw new Error('Not signed in')
  if (user.plan === 'guest') throw new Error('Create a free account to upgrade')
  return user
}

function coercePlan(v: unknown): PaidPlan {
  if (v !== 'plus' && v !== 'pro') throw new Error('Unknown plan')
  return v
}
function coerceInterval(v: unknown): BillingInterval {
  if (v !== 'month' && v !== 'year') throw new Error('Unknown billing interval')
  return v
}

function statusFor(db: DB, user: User) {
  const b = billingOf(db)
  return {
    plan: user.plan,
    subscription: b.subscriptions[user.id] ?? null,
    invoices: Object.values(b.invoices)
      .filter((i) => i.user_id === user.id)
      .sort((a, b2) => (a.created_at < b2.created_at ? 1 : -1))
  }
}

export const billingHandlers: Record<string, Handler> = {
  // Public-ish, but still behind a session like every non-auth channel.
  'billing:catalog'(_db, _data, env) {
    return {
      plans: PLAN_CATALOG,
      limits: PLAN_LIMITS,
      perks: PERKS,
      /** 'sandbox' = simulated checkout; 'none' = payments not live. */
      provider: env.billingSandbox ? 'sandbox' : 'none'
    }
  },

  'billing:status'(db, _data, env, ctx) {
    const user = ctx?.user
    if (!user) throw new Error('Not signed in')
    settleSubscription(db, user, env.nowStr())
    return statusFor(db, user)
  },

  'billing:quote'(_db, data) {
    return quote(coercePlan(data?.plan), coerceInterval(data?.interval), data?.coupon)
  },

  // Start a checkout. A real provider returns a hosted-checkout URL here; the
  // renderer opens it and the provider's webhook completes the purchase.
  'billing:createCheckout'(db, data, env, ctx) {
    const user = requireBuyer(ctx)
    if (!env.billingSandbox) throw new Error('Payments aren’t live yet')
    const plan = coercePlan(data?.plan)
    const interval = coerceInterval(data?.interval)
    const current = billingOf(db).subscriptions[user.id]
    if (current?.status === 'active' && current.plan === plan && current.interval === interval) {
      throw new Error('You’re already on this plan')
    }
    const q = quote(plan, interval, data?.coupon)
    if (q.couponError) throw new Error('That promo code can’t be used here')
    const session: CheckoutSession = {
      id: env.uuid(),
      user_id: user.id,
      plan,
      interval,
      quote: q,
      status: 'open',
      url: null,
      created_at: env.nowStr()
    }
    billingOf(db).checkouts[session.id] = session
    return session
  },

  // SANDBOX ONLY — stands in for the provider's hosted page + webhook.
  'billing:completeSandboxCheckout'(db, data, env, ctx) {
    const user = requireBuyer(ctx)
    if (!env.billingSandbox) throw new Error('Sandbox checkout is disabled')
    const b = billingOf(db)
    const session = b.checkouts[data?.id]
    if (!session || session.user_id !== user.id) throw new Error('Checkout not found')
    if (session.status !== 'open') throw new Error('This checkout is already closed')
    const outcome = data?.outcome
    const now = env.nowStr()
    if (outcome === 'cancel') {
      session.status = 'canceled'
      return { session, status: statusFor(db, user) }
    }
    const invoice: Invoice = {
      id: env.uuid(),
      user_id: user.id,
      number: `SBX-${String(Object.keys(b.invoices).length + 1).padStart(4, '0')}`,
      plan: session.plan,
      interval: session.interval,
      amount: session.quote.total,
      currency: session.quote.currency,
      status: outcome === 'success' ? 'paid' : 'failed',
      created_at: now
    }
    b.invoices[invoice.id] = invoice
    if (outcome !== 'success') {
      session.status = 'failed'
      return { session, status: statusFor(db, user) }
    }
    session.status = 'complete'
    // Plan changes restart the period (a real provider would prorate).
    b.subscriptions[user.id] = {
      user_id: user.id,
      plan: session.plan,
      interval: session.interval,
      status: 'active',
      current_period_start: now,
      current_period_end: addInterval(now, session.interval),
      cancel_at_period_end: false,
      provider: 'sandbox',
      provider_ref: null,
      created_at: b.subscriptions[user.id]?.created_at ?? now,
      updated_at: now
    }
    user.plan = session.plan
    return { session, status: statusFor(db, user) }
  },

  // Cancel = stop renewing; the plan stays until the paid period ends.
  'billing:cancel'(db, _data, env, ctx) {
    const user = requireBuyer(ctx)
    const sub = billingOf(db).subscriptions[user.id]
    if (!sub || sub.status !== 'active') throw new Error('No active subscription')
    sub.cancel_at_period_end = true
    sub.updated_at = env.nowStr()
    return statusFor(db, user)
  },

  'billing:resume'(db, _data, env, ctx) {
    const user = requireBuyer(ctx)
    const sub = billingOf(db).subscriptions[user.id]
    if (!sub || sub.status !== 'active') throw new Error('No active subscription')
    sub.cancel_at_period_end = false
    sub.updated_at = env.nowStr()
    return statusFor(db, user)
  }
}

export const BILLING_WRITE_CHANNELS = [
  'billing:status', // may settle an expired subscription
  'billing:createCheckout',
  'billing:completeSandboxCheckout',
  'billing:cancel',
  'billing:resume'
]
