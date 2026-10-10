// Ad slots — the client side of advertising.
//
// Components render <AdSlot placement="…"> and never know where an ad came
// from: they ask the active AdProvider for a creative. Today that is the
// HOUSE provider — self-promotion for our own plans and features, bundled in
// the app, zero cost, no third-party script, no tracking. A real ad network
// (or direct-sold sponsorships, WILD_IDEAS P7) plugs in later with
// setAdProvider(); what that needs (consent, CSP, network SDK) is written up
// in docs/MONETIZATION.md.
//
// Placement policy: ads live on discovery surfaces only (Browse, the Projects
// library) — never inside the editor views, and never for paid plans.

export type AdPlacement = 'card' | 'banner' | 'strip'
/** What clicking the creative's call-to-action does (handled by AdSlot). */
export type AdAction =
  { kind: 'pricing'; plan?: 'plus' | 'pro' } | { kind: 'browse' } | { kind: 'url'; href: string }

export interface AdCreative {
  id: string
  /** Advertiser label shown in the "Sponsored · …" line. */
  sponsor: 'house' | string
  placements: AdPlacement[]
  /** Art-tile icon: a UiIcon name (components/ui/icons.js). */
  icon: string
  hue: number
  /** i18n base key — `${copyKey}.title|body|cta`. Network ads carry raw text instead. */
  copyKey?: string
  text?: { title: string; body: string; cta: string }
  action: AdAction
}

export interface AdContext {
  placement: AdPlacement
  /** Rotates creatives between slots on the same page. */
  seed: number
  /** Actions that make no sense here (e.g. "open Browse" on the Browse page). */
  exclude: AdAction['kind'][]
}

export type AdEvent = 'impression' | 'click' | 'dismiss'

export interface AdProvider {
  name: string
  pick(ctx: AdContext): AdCreative | null
  track(event: AdEvent, ad: AdCreative, placement: AdPlacement): void
}

const HOUSE_ADS: AdCreative[] = [
  {
    id: 'house-go-plus',
    sponsor: 'house',
    placements: ['card', 'banner', 'strip'],
    icon: 'sparkles',
    hue: 262,
    copyKey: 'ads.house.goPlus',
    action: { kind: 'pricing', plan: 'plus' }
  },
  {
    id: 'house-room',
    sponsor: 'house',
    placements: ['card', 'banner'],
    icon: 'tree-deciduous',
    hue: 140,
    copyKey: 'ads.house.room',
    action: { kind: 'pricing', plan: 'plus' }
  },
  {
    id: 'house-pro',
    sponsor: 'house',
    placements: ['card', 'banner', 'strip'],
    icon: 'dna',
    hue: 200,
    copyKey: 'ads.house.pro',
    action: { kind: 'pricing', plan: 'pro' }
  },
  {
    id: 'house-browse',
    sponsor: 'house',
    placements: ['banner', 'strip'],
    icon: 'compass',
    hue: 28,
    copyKey: 'ads.house.browse',
    action: { kind: 'browse' }
  }
]

// Session-scoped dismissals (per-viewer convenience; storage may be refused).
const DISMISS_KEY = 'ads:dismissed'
function readDismissed(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(DISMISS_KEY) || '[]'))
  } catch {
    return new Set()
  }
}
export function dismissAd(id: string): void {
  const set = readDismissed()
  set.add(id)
  try {
    sessionStorage.setItem(DISMISS_KEY, JSON.stringify([...set]))
  } catch {
    /* ignore */
  }
}

/** In-memory event log — what a network/analytics provider would receive. */
export const adEventLog: Array<{ event: AdEvent; id: string; placement: AdPlacement; at: number }> =
  []

export const houseProvider: AdProvider = {
  name: 'house',
  pick({ placement, seed, exclude }) {
    const dismissed = readDismissed()
    const pool = HOUSE_ADS.filter(
      (a) =>
        a.placements.includes(placement) && !exclude.includes(a.action.kind) && !dismissed.has(a.id)
    )
    return pool.length ? pool[Math.abs(Math.floor(seed)) % pool.length] : null
  },
  track(event, ad, placement) {
    adEventLog.push({ event, id: ad.id, placement, at: Date.now() })
    if (adEventLog.length > 200) adEventLog.shift()
  }
}

let provider: AdProvider = houseProvider
export function getAdProvider(): AdProvider {
  return provider
}
/** Swap in a network / sponsorship provider (see docs/MONETIZATION.md). */
export function setAdProvider(p: AdProvider): void {
  provider = p
}
