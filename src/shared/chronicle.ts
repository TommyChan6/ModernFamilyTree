// The chronicle — eras and story events on the project's shared date axis.
// Platform-free (used by the channel handlers in dbCore.ts AND by the views):
// sanitizers that every write goes through, the event-kind catalog, era preset
// packs, and the pure time math the Timeline / Birth graph / profile read
// (era lanes, "which era is this year in", who lived through what).
// Tests: tests/chronicle.test.js.

import type { DateValue, Era, StoryEvent } from './types'
import { toOrdinal } from './calendarMath'

// ── Catalogs ──────────────────────────────────────────────────────────────────

/** Event kinds: an icon name (components/ui/icons.js) + colour pair the marker uses unless overridden. */
export const EVENT_KINDS = [
  { id: 'milestone', label: 'Milestone', icon: 'star', color: '#f5c542' },
  { id: 'battle', label: 'Battle', icon: 'swords', color: '#e5534b' },
  { id: 'war', label: 'War', icon: 'shield', color: '#b5413a' },
  { id: 'coronation', label: 'Coronation', icon: 'crown', color: '#d4af37' },
  { id: 'founding', label: 'Founding', icon: 'castle', color: '#8b6cc5' },
  { id: 'migration', label: 'Migration', icon: 'compass', color: '#3fa7d6' },
  { id: 'journey', label: 'Journey', icon: 'sailboat', color: '#2bb3a3' },
  { id: 'meeting', label: 'First meeting', icon: 'handshake', color: '#e98fb3' },
  { id: 'wedding', label: 'Wedding', icon: 'gem', color: '#f0a8c8' },
  { id: 'treaty', label: 'Treaty', icon: 'scroll', color: '#c9a66b' },
  { id: 'discovery', label: 'Discovery', icon: 'lightbulb', color: '#f2d15c' },
  { id: 'disaster', label: 'Disaster', icon: 'tornado', color: '#e0703a' },
  { id: 'betrayal', label: 'Betrayal', icon: 'sword', color: '#9a3b4a' },
  { id: 'prophecy', label: 'Prophecy', icon: 'eye', color: '#9d7ff0' },
  { id: 'celebration', label: 'Celebration', icon: 'party-popper', color: '#5cc98a' },
  { id: 'loss', label: 'Loss', icon: 'heart-crack', color: '#8a93a6' },
  { id: 'custom', label: 'Other', icon: 'sparkle', color: '#6c8ef5' }
] as const
export type EventKindId = (typeof EVENT_KINDS)[number]['id']
const KIND_BY_ID = new Map<string, (typeof EVENT_KINDS)[number]>(EVENT_KINDS.map((k) => [k.id, k]))
export function eventKind(id: string | null | undefined) {
  return KIND_BY_ID.get(String(id || '')) || KIND_BY_ID.get('custom')!
}

/** Swatches offered for eras (each reads on both themes as a soft band). */
export const ERA_COLORS = [
  '#6c8ef5',
  '#8b6cc5',
  '#e98fb3',
  '#e5534b',
  '#e0903a',
  '#d4af37',
  '#5cc98a',
  '#2bb3a3',
  '#3fa7d6',
  '#8a93a6'
]

// ── Sanitizers (every eras:* / events:* write passes through these) ──────────

const HEX = /^#[0-9a-f]{6}$/i

/** A date from a form: a DateValue-ish object, a plain year, or a numeric
 *  string. Anything unusable → null. */
export function sanitizeDate(v: unknown): DateValue | null {
  if (v == null || v === '') return null
  if (typeof v === 'number' || typeof v === 'string') {
    const y = Number(v)
    if (!Number.isFinite(y)) return null
    return { year: Math.round(y), month: null, day: null, precision: 'year', calendar: 'gregorian' }
  }
  if (typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const y = Number(o.year)
  if (o.year == null || o.year === '' || !Number.isFinite(y)) return null
  const m = Number(o.month)
  const d = Number(o.day)
  const month = Number.isInteger(m) && m >= 1 && m <= 12 ? m : null
  const day = month && Number.isInteger(d) && d >= 1 && d <= 31 ? d : null
  return {
    year: Math.round(y),
    month,
    day,
    precision: day ? 'day' : month ? 'month' : 'year',
    calendar: 'gregorian'
  }
}

const str = (v: unknown, max: number) =>
  String(v ?? '')
    .trim()
    .slice(0, max)

/** Put a (start, end) pair in order — a reversed range is a typo, not intent. */
function ordered(a: DateValue | null, b: DateValue | null): [DateValue | null, DateValue | null] {
  const oa = toOrdinal(a)
  const ob = toOrdinal(b)
  return oa != null && ob != null && ob < oa ? [b, a] : [a, b]
}

/** Apply a (partial) era payload onto a record, sanitizing every field. */
export function applyEraPatch(era: Era, data: Record<string, unknown>): Era {
  if ('name' in data) era.name = str(data.name, 80) || 'Untitled era'
  if ('start' in data) era.start = sanitizeDate(data.start)
  if ('end' in data) era.end = sanitizeDate(data.end)
  ;[era.start, era.end] = ordered(era.start, era.end)
  if ('color' in data && HEX.test(String(data.color))) era.color = String(data.color)
  if ('icon' in data) era.icon = str(data.icon, 40)
  if ('description' in data) era.description = str(data.description, 2000)
  return era
}

/** Apply a (partial) event payload; `personExists` filters participants down
 *  to real people of the project. */
export function applyEventPatch(
  ev: StoryEvent,
  data: Record<string, unknown>,
  personExists: (id: string) => boolean
): StoryEvent {
  if ('title' in data) ev.title = str(data.title, 120) || 'Untitled event'
  if ('kind' in data) ev.kind = KIND_BY_ID.has(String(data.kind)) ? String(data.kind) : 'custom'
  if ('icon' in data) ev.icon = str(data.icon, 40)
  if ('color' in data) ev.color = HEX.test(String(data.color)) ? String(data.color) : ''
  if ('date' in data) ev.date = sanitizeDate(data.date)
  if ('end' in data) ev.end = sanitizeDate(data.end)
  ;[ev.date, ev.end] = ordered(ev.date, ev.end)
  if ('importance' in data) {
    const n = Math.round(Number(data.importance))
    ev.importance = Number.isFinite(n) ? Math.max(1, Math.min(3, n)) : 2
  }
  if ('person_ids' in data) {
    const list = Array.isArray(data.person_ids) ? data.person_ids : []
    ev.person_ids = [...new Set(list.map(String))].filter(personExists).slice(0, 500)
  }
  if ('place' in data) ev.place = str(data.place, 120)
  if ('description' in data) ev.description = str(data.description, 4000)
  return ev
}

// ── Time math ─────────────────────────────────────────────────────────────────

/** An era's span as ordinals; open ends fall back to the given bounds. */
export function eraSpan(era: Era, lo = -Infinity, hi = Infinity): [number, number] {
  const a = toOrdinal(era.start)
  const b = toOrdinal(era.end)
  return [a ?? lo, b ?? hi]
}

/** Stack overlapping eras into lanes (greedy, earliest start first) so the
 *  views can draw them side by side. Returns lane per era id + lane count. */
export function eraLanes(eras: Era[]): { lane: Map<string, number>; count: number } {
  const sorted = [...eras].sort((x, y) => {
    const [ax, bx] = eraSpan(x)
    const [ay, by] = eraSpan(y)
    return ax - ay || bx - by || x.name.localeCompare(y.name)
  })
  const laneEnds: number[] = []
  const lane = new Map<string, number>()
  for (const e of sorted) {
    const [a, b] = eraSpan(e)
    let i = laneEnds.findIndex((end) => end <= a)
    if (i === -1) {
      i = laneEnds.length
      laneEnds.push(b)
    } else laneEnds[i] = b
    lane.set(e.id, i)
  }
  return { lane, count: laneEnds.length }
}

/** Every era covering a moment (start inclusive, end exclusive). */
export function erasAt(eras: Era[], ordinal: number | null | undefined): Era[] {
  if (ordinal == null || !Number.isFinite(ordinal)) return []
  return eras.filter((e) => {
    const [a, b] = eraSpan(e)
    return ordinal >= a && ordinal < b
  })
}

/** Eras a life touched (birth → death, or → `refYear` while alive). */
export function erasLivedThrough(
  eras: Era[],
  birth: DateValue | null | undefined,
  death: DateValue | null | undefined,
  refYear: number
): Era[] {
  const b = toOrdinal(birth)
  if (b == null) return []
  const d = toOrdinal(death) ?? refYear
  return eras
    .filter((e) => {
      const [a, z] = eraSpan(e)
      return a < d && z > b
    })
    .sort((x, y) => eraSpan(x)[0] - eraSpan(y)[0])
}

/** A person's story events, in date order (undated last). */
export function eventsOf(events: StoryEvent[], personId: string): StoryEvent[] {
  return events
    .filter((e) => e.person_ids.includes(personId))
    .sort((x, y) => (toOrdinal(x.date) ?? Infinity) - (toOrdinal(y.date) ?? Infinity))
}

// ── Era presets ───────────────────────────────────────────────────────────────

export interface EraSeed {
  name: string
  start: number | null
  end: number | null
  color: string
  icon: string
  description: string
}

export const ERA_PACKS = [
  {
    id: 'world',
    label: 'World history',
    icon: 'earth',
    hint: 'Wars, reigns and revolutions, 1700 → today'
  },
  { id: 'generations', label: 'Generations', icon: 'users', hint: 'Lost Generation → Gen Alpha' },
  {
    id: 'centuries',
    label: 'Centuries',
    icon: 'hourglass',
    hint: 'One band per century across your project'
  },
  {
    id: 'fantasy',
    label: 'Fantasy ages',
    icon: 'wand-sparkles',
    hint: 'Myth → Kings → Iron → Twilight, fitted to your years'
  }
] as const

const WORLD: EraSeed[] = [
  {
    name: 'Age of Enlightenment',
    start: 1685,
    end: 1789,
    color: '#d4af37',
    icon: 'lightbulb',
    description: 'Reason, science and the rights of man.'
  },
  {
    name: 'Industrial Revolution',
    start: 1760,
    end: 1840,
    color: '#8a93a6',
    icon: 'factory',
    description: 'Steam, mills and the move to the cities.'
  },
  {
    name: 'Napoleonic Wars',
    start: 1803,
    end: 1815,
    color: '#e5534b',
    icon: 'swords',
    description: 'Europe at war with — and for — Napoleon.'
  },
  {
    name: 'Victorian Era',
    start: 1837,
    end: 1901,
    color: '#8b6cc5',
    icon: 'crown',
    description: 'The reign of Queen Victoria.'
  },
  {
    name: 'The Gilded Age',
    start: 1870,
    end: 1900,
    color: '#e0903a',
    icon: 'train-front',
    description: 'Railroads, fortunes and rapid change.'
  },
  {
    name: 'World War I',
    start: 1914,
    end: 1918,
    color: '#b5413a',
    icon: 'shield',
    description: 'The Great War.'
  },
  {
    name: 'The Roaring Twenties',
    start: 1920,
    end: 1929,
    color: '#e98fb3',
    icon: 'music',
    description: 'Jazz, prosperity and new freedoms.'
  },
  {
    name: 'The Great Depression',
    start: 1929,
    end: 1939,
    color: '#6b7186',
    icon: 'trending-down',
    description: 'Hard times across the world.'
  },
  {
    name: 'World War II',
    start: 1939,
    end: 1945,
    color: '#c0392b',
    icon: 'plane',
    description: 'The Second World War.'
  },
  {
    name: 'Cold War',
    start: 1947,
    end: 1991,
    color: '#3fa7d6',
    icon: 'snowflake',
    description: 'East against West, under the shadow of the bomb.'
  },
  {
    name: 'Space Age',
    start: 1957,
    end: 1975,
    color: '#2bb3a3',
    icon: 'rocket',
    description: 'Sputnik to the Moon landings.'
  },
  {
    name: 'Digital Age',
    start: 1990,
    end: null,
    color: '#5cc98a',
    icon: 'laptop',
    description: 'The internet changes everything.'
  }
]

const GENERATIONS: EraSeed[] = [
  {
    name: 'Lost Generation',
    start: 1883,
    end: 1901,
    color: '#8a93a6',
    icon: 'medal',
    description: 'Came of age in World War I.'
  },
  {
    name: 'Greatest Generation',
    start: 1901,
    end: 1928,
    color: '#d4af37',
    icon: 'award',
    description: 'Grew up in the Depression, fought World War II.'
  },
  {
    name: 'Silent Generation',
    start: 1928,
    end: 1946,
    color: '#8b6cc5',
    icon: 'radio',
    description: 'Children of the Depression and the war.'
  },
  {
    name: 'Baby Boomers',
    start: 1946,
    end: 1965,
    color: '#e0903a',
    icon: 'tv',
    description: 'The post-war baby boom.'
  },
  {
    name: 'Generation X',
    start: 1965,
    end: 1981,
    color: '#e5534b',
    icon: 'video',
    description: 'Latchkey kids of the late Cold War.'
  },
  {
    name: 'Millennials',
    start: 1981,
    end: 1997,
    color: '#3fa7d6',
    icon: 'disc',
    description: 'Came of age with the internet.'
  },
  {
    name: 'Generation Z',
    start: 1997,
    end: 2013,
    color: '#2bb3a3',
    icon: 'smartphone',
    description: 'The first truly digital natives.'
  },
  {
    name: 'Generation Alpha',
    start: 2013,
    end: 2026,
    color: '#5cc98a',
    icon: 'bot',
    description: 'Born into smartphones and AI.'
  }
]

const FANTASY = [
  {
    name: 'Age of Myth',
    icon: 'wand-sparkles',
    color: '#9d7ff0',
    description: 'When legends walked the land.'
  },
  {
    name: 'Age of Kings',
    icon: 'crown',
    color: '#d4af37',
    description: 'Crowns rise; houses are founded.'
  },
  {
    name: 'Age of Iron',
    icon: 'swords',
    color: '#e5534b',
    description: 'War, conquest and steel.'
  },
  { name: 'Age of Twilight', icon: 'moon', color: '#3fa7d6', description: 'The old powers fade.' }
]

/** The eras a pack contributes to a project spanning [minYear, maxYear]:
 *  real-world packs keep only eras that overlap it; centuries and fantasy
 *  ages are fitted to it. */
export function presetEras(packId: string, minYear: number, maxYear: number): EraSeed[] {
  const lo = Math.floor(Math.min(minYear, maxYear))
  const hi = Math.ceil(Math.max(minYear, maxYear))
  const overlaps = (e: EraSeed) => (e.start ?? -Infinity) < hi && (e.end ?? Infinity) > lo
  if (packId === 'world') return WORLD.filter(overlaps)
  if (packId === 'generations') return GENERATIONS.filter(overlaps)
  if (packId === 'centuries') {
    const out: EraSeed[] = []
    const ord = (n: number) => {
      const s = ['th', 'st', 'nd', 'rd']
      const v = n % 100
      return n + (s[(v - 20) % 10] || s[v] || s[0])
    }
    for (let c = Math.floor(lo / 100) * 100; c < hi; c += 100) {
      const n = c / 100 + 1
      out.push({
        name: `${ord(n)} century`,
        start: c,
        end: c + 100,
        color: ERA_COLORS[(n - 1) % ERA_COLORS.length],
        icon: 'hourglass',
        description: `${c}–${c + 99}`
      })
    }
    return out
  }
  if (packId === 'fantasy') {
    const span = Math.max(4, hi - lo)
    const step = span / FANTASY.length
    return FANTASY.map((f, i) => ({
      ...f,
      start: Math.round(lo + i * step),
      end: i === FANTASY.length - 1 ? null : Math.round(lo + (i + 1) * step)
    }))
  }
  return []
}
