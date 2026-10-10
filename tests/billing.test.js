import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { randomUUID } from 'crypto'
import { channelHandlers, createInitialDB, WRITE_CHANNELS } from '../src/shared/dbCore'
import { __setPbkdf2IterationsForTesting, resolveSession, PLAN_LIMITS } from '../src/shared/auth'
import {
  PLAN_CATALOG,
  PERKS,
  addInterval,
  isPaidPlan,
  offerFor,
  planHasPerk,
  quote,
  settleSubscription
} from '../src/shared/billing'
import { ICON_NAMES } from '../src/renderer/src/components/ui/icons.js'

// Monetization core: catalog, quotes and the SANDBOX checkout flow. No real
// provider exists yet (docs/MONETIZATION.md) — these pin the client contract
// the hosted backend must keep.

beforeAll(() => __setPbkdf2IterationsForTesting(1000))

let NOW = '2026-01-15 12:00:00'
const makeEnv = (sandbox) => ({
  uuid: () => randomUUID(),
  nowStr: () => NOW,
  storeImageFile: (p) => p,
  removeImageFile: () => {},
  billingSandbox: sandbox
})
const env = makeEnv(true)
const invoke = (db, channel, data, ctx, e = env) => channelHandlers[channel](db, data, e, ctx)
const ctxFor = (db, token) => ({ user: resolveSession(db, token, NOW), token })

let db
let ctx
beforeEach(async () => {
  NOW = '2026-01-15 12:00:00'
  db = createInitialDB(env)
  const reg = await invoke(db, 'auth:register', {
    username: 'buyer',
    password: 'hunter2hunter2',
    acceptedTerms: true
  })
  ctx = ctxFor(db, reg.token)
})

async function buy(plan = 'plus', interval = 'month', coupon) {
  const session = invoke(db, 'billing:createCheckout', { plan, interval, coupon }, ctx)
  return invoke(db, 'billing:completeSandboxCheckout', { id: session.id, outcome: 'success' }, ctx)
}

describe('catalog', () => {
  it('every perk icon is a registered UiIcon name (no emoji)', () => {
    for (const [key, perk] of Object.entries(PERKS)) {
      expect(ICON_NAMES, key).toContain(perk.icon)
    }
  })

  it('every paid plan has limits, prices and only known perks', () => {
    for (const offer of PLAN_CATALOG) {
      expect(PLAN_LIMITS[offer.id], offer.id).toBeDefined()
      for (const perk of offer.perks) expect(PERKS[perk], perk).toBeDefined()
      if (offer.id !== 'free') {
        expect(offer.price.month).toBeGreaterThan(0)
        // Annual billing must actually be a deal.
        expect(offer.price.year).toBeLessThan(offer.price.month * 12)
      }
    }
  })

  it('higher tiers raise every limit and keep every lower-tier perk', () => {
    const sorted = [...PLAN_CATALOG].sort((a, b) => a.rank - b.rank)
    for (let i = 1; i < sorted.length; i++) {
      const lo = PLAN_LIMITS[sorted[i - 1].id]
      const hi = PLAN_LIMITS[sorted[i].id]
      for (const k of Object.keys(lo)) expect(hi[k]).toBeGreaterThan(lo[k])
      for (const perk of sorted[i - 1].perks) expect(sorted[i].perks).toContain(perk)
    }
  })

  it('free, guest and unknown plans see ads; paid plans do not', () => {
    expect(planHasPerk('free', 'adFree')).toBe(false)
    expect(planHasPerk('guest', 'adFree')).toBe(false)
    expect(planHasPerk('mystery', 'adFree')).toBe(false)
    expect(planHasPerk('plus', 'adFree')).toBe(true)
    expect(planHasPerk('pro', 'adFree')).toBe(true)
    expect(offerFor('mystery').id).toBe('free')
    expect(isPaidPlan('guest')).toBe(false)
  })
})

describe('quote', () => {
  it('applies coupons and reports annual savings', () => {
    const q = quote('plus', 'year', 'forest20')
    expect(q.coupon).toBe('FOREST20')
    expect(q.discount).toBe(Math.round(q.subtotal * 0.2))
    expect(q.total).toBe(q.subtotal - q.discount)
    expect(q.annualSavings).toBe(offerFor('plus').price.month * 12 - offerFor('plus').price.year)
    expect(quote('plus', 'month').annualSavings).toBe(0)
  })

  it('explains why a code did not apply', () => {
    expect(quote('pro', 'month', 'NOPE').couponError).toBe('unknown')
    const annualOnly = quote('pro', 'month', 'EARLYBIRD')
    expect(annualOnly.couponError).toBe('interval')
    expect(annualOnly.discount).toBe(0)
  })

  it('rejects unknown plans', () => {
    expect(() => invoke(db, 'billing:quote', { plan: 'free', interval: 'month' }, ctx)).toThrow()
    expect(() => invoke(db, 'billing:quote', { plan: 'plus', interval: 'week' }, ctx)).toThrow()
  })
})

describe('sandbox checkout', () => {
  it('a successful checkout upgrades the plan, lifts quotas and records an invoice', async () => {
    const res = await buy('plus', 'year', 'FOREST20')
    expect(res.session.status).toBe('complete')
    expect(db.users[ctx.user.id].plan).toBe('plus')
    const status = res.status
    expect(status.subscription).toMatchObject({
      plan: 'plus',
      interval: 'year',
      status: 'active',
      cancel_at_period_end: false,
      current_period_end: '2027-01-15 12:00:00'
    })
    expect(status.invoices).toHaveLength(1)
    expect(status.invoices[0]).toMatchObject({
      status: 'paid',
      amount: quote('plus', 'year', 'FOREST20').total
    })
    expect(invoke(db, 'auth:usage', {}, ctx).maxProjects).toBe(PLAN_LIMITS.plus.maxProjects)
  })

  it('a declined payment keeps the plan and logs a failed invoice', () => {
    const session = invoke(db, 'billing:createCheckout', { plan: 'pro', interval: 'month' }, ctx)
    const res = invoke(
      db,
      'billing:completeSandboxCheckout',
      { id: session.id, outcome: 'fail' },
      ctx
    )
    expect(res.session.status).toBe('failed')
    expect(db.users[ctx.user.id].plan).toBe('free')
    expect(res.status.invoices[0].status).toBe('failed')
    // A closed checkout can't be replayed.
    expect(() =>
      invoke(db, 'billing:completeSandboxCheckout', { id: session.id, outcome: 'success' }, ctx)
    ).toThrow(/closed/)
  })

  it('cancel keeps the plan until period end, then reverts to free', async () => {
    await buy('pro', 'month')
    const canceled = invoke(db, 'billing:cancel', {}, ctx)
    expect(canceled.subscription.cancel_at_period_end).toBe(true)
    expect(db.users[ctx.user.id].plan).toBe('pro') // still paid up
    NOW = '2026-02-16 00:00:00'
    const later = invoke(db, 'billing:status', {}, ctx)
    expect(later.plan).toBe('free')
    expect(later.subscription.status).toBe('canceled')
  })

  it('resume undoes a pending cancellation; uncanceled plans renew', async () => {
    await buy('plus', 'month')
    invoke(db, 'billing:cancel', {}, ctx)
    invoke(db, 'billing:resume', {}, ctx)
    NOW = '2026-02-20 00:00:00'
    const s = invoke(db, 'billing:status', {}, ctx)
    expect(s.plan).toBe('plus')
    expect(s.subscription.current_period_end).toBe('2026-03-15 12:00:00')
  })

  it('refuses duplicates, guests, strangers and bad codes', async () => {
    await buy('plus', 'month')
    expect(() =>
      invoke(db, 'billing:createCheckout', { plan: 'plus', interval: 'month' }, ctx)
    ).toThrow(/already/)
    expect(() =>
      invoke(db, 'billing:createCheckout', { plan: 'pro', interval: 'month', coupon: 'NOPE' }, ctx)
    ).toThrow(/promo/)
    const guest = invoke(db, 'auth:guest', {})
    expect(() =>
      invoke(
        db,
        'billing:createCheckout',
        { plan: 'plus', interval: 'month' },
        ctxFor(db, guest.token)
      )
    ).toThrow(/free account/)
    const reg = await invoke(db, 'auth:register', {
      username: 'other',
      password: 'hunter2hunter2',
      acceptedTerms: true
    })
    const session = invoke(db, 'billing:createCheckout', { plan: 'pro', interval: 'year' }, ctx)
    expect(() =>
      invoke(
        db,
        'billing:completeSandboxCheckout',
        { id: session.id, outcome: 'success' },
        ctxFor(db, reg.token)
      )
    ).toThrow(/not found/)
  })

  it('with the sandbox off, checkout refuses (payments not live)', () => {
    const off = makeEnv(false)
    expect(invoke(db, 'billing:catalog', {}, ctx, off).provider).toBe('none')
    expect(() =>
      invoke(db, 'billing:createCheckout', { plan: 'plus', interval: 'month' }, ctx, off)
    ).toThrow(/aren’t live/)
  })

  it('every mutating billing channel persists', () => {
    for (const ch of [
      'billing:createCheckout',
      'billing:completeSandboxCheckout',
      'billing:cancel',
      'billing:resume'
    ]) {
      expect(WRITE_CHANNELS.has(ch), ch).toBe(true)
    }
  })
})

describe('dates', () => {
  it('adds calendar months and years in UTC', () => {
    expect(addInterval('2026-01-31 08:00:00', 'year')).toBe('2027-01-31 08:00:00')
    expect(addInterval('2026-12-15 00:00:00', 'month')).toBe('2027-01-15 00:00:00')
  })

  it('settle is a no-op without a subscription', () => {
    expect(settleSubscription(db, db.users[ctx.user.id], NOW)).toBe(false)
  })
})
