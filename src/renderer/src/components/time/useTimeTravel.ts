// The Time Travel engine — one app-wide instance shared by the slider UI and
// the graph/timeline views. Holds the scrubbed year (null = "now", show
// everything), the playback loop, speed/direction/loop settings, and the
// event index derived from the data.
//
// The state lives in a detached effectScope so it survives view remounts
// (GraphCanvas and TimelineView are keyed by project and come and go).

import { ref, computed, watch, effectScope, type Ref, type ComputedRef } from 'vue'
// @ts-expect-error — the store is still JS; drop this when it converts to TS
import { useMainStore } from '../../store/index.js'
import { computeTimeRange, computeTimeEvents, type TimeRange, type TimeEvent } from './timeMath'

export const TIME_SPEEDS = [
  { label: '½×', yps: 1.5 },
  { label: '1×', yps: 3 },
  { label: '2×', yps: 6 },
  { label: '4×', yps: 12 },
  { label: '8×', yps: 24 }
] as const

export interface TimeTravel {
  /** Scrubbed (fractional) year; null = inactive, everything visible. */
  year: Ref<number | null>
  playing: Ref<boolean>
  reversed: Ref<boolean>
  looping: Ref<boolean>
  speedIdx: Ref<number>
  active: ComputedRef<boolean>
  /** year for visibility checks — Infinity while inactive so `date > gateYear` is never true. */
  gateYear: ComputedRef<number>
  range: ComputedRef<TimeRange | null>
  events: ComputedRef<TimeEvent[]>
  /** 0..1 position across the range (1 while inactive). */
  progress: ComputedRef<number>
  setYear: (y: number | null) => void
  play: () => void
  pause: () => void
  togglePlay: () => void
  stop: () => void
  stepYears: (n: number) => void
  skipEvent: (dir: 1 | -1) => void
  cycleSpeed: () => void
  toggleReversed: () => void
  toggleLooping: () => void
}

function create(): TimeTravel {
  const store = useMainStore()

  const year = ref<number | null>(null)
  const playing = ref(false)
  const reversed = ref(false)
  const looping = ref(false)
  const speedIdx = ref(1) // 1× by default

  const range = computed(() => computeTimeRange(store.persons, store.relationships))
  const events = computed(() => computeTimeEvents(store.persons, store.relationships))
  const active = computed(() => year.value != null && range.value != null)
  const gateYear = computed(() => (active.value ? (year.value as number) : Infinity))
  const progress = computed(() => {
    const r = range.value
    if (!r) return 1
    const y = year.value ?? r.maxYear
    return Math.min(1, Math.max(0, (y - r.minYear) / (r.maxYear - r.minYear)))
  })

  function clamp(y: number): number {
    const r = range.value
    return r ? Math.min(r.maxYear, Math.max(r.minYear, y)) : y
  }

  function setYear(y: number | null): void {
    year.value = y == null ? null : clamp(y)
  }

  let raf = 0
  let lastTs = 0
  function frame(ts: number): void {
    raf = 0
    if (!playing.value) return
    const r = range.value
    if (!r) {
      playing.value = false
      return
    }
    const dt = Math.min(0.05, Math.max(0, (ts - lastTs) / 1000))
    lastTs = ts
    const dir = reversed.value ? -1 : 1
    let y =
      (year.value ?? (dir > 0 ? r.minYear : r.maxYear)) + dir * TIME_SPEEDS[speedIdx.value].yps * dt
    if (dir > 0 && y >= r.maxYear) {
      if (looping.value) y = r.minYear
      else {
        y = r.maxYear
        playing.value = false
      }
    } else if (dir < 0 && y <= r.minYear) {
      if (looping.value) y = r.maxYear
      else {
        y = r.minYear
        playing.value = false
      }
    }
    year.value = y
    if (playing.value) raf = requestAnimationFrame(frame)
  }

  function play(): void {
    const r = range.value
    if (!r || playing.value) return
    // Nothing left to reveal in the travel direction → restart from the far end.
    const dir = reversed.value ? -1 : 1
    if (dir > 0 && (year.value == null || year.value >= r.maxYear - 1e-6)) year.value = r.minYear
    else if (dir < 0 && (year.value == null || year.value <= r.minYear + 1e-6))
      year.value = r.maxYear
    playing.value = true
    lastTs = performance.now()
    if (!raf) raf = requestAnimationFrame(frame)
  }

  function pause(): void {
    playing.value = false
    if (raf) {
      cancelAnimationFrame(raf)
      raf = 0
    }
  }

  function togglePlay(): void {
    if (playing.value) pause()
    else play()
  }

  /** Stop = pause and return to "now" (everything visible). */
  function stop(): void {
    pause()
    year.value = null
  }

  function stepYears(n: number): void {
    const r = range.value
    if (!r) return
    setYear((year.value ?? r.maxYear) + n)
  }

  function skipEvent(dir: 1 | -1): void {
    const r = range.value
    if (!r) return
    const cur = year.value ?? r.maxYear
    const evs = events.value
    if (dir > 0) {
      const e = evs.find((ev) => ev.year > cur + 1e-6)
      setYear(e ? e.year : r.maxYear)
    } else {
      for (let i = evs.length - 1; i >= 0; i--) {
        if (evs[i].year < cur - 1e-6) {
          setYear(evs[i].year)
          return
        }
      }
      setYear(r.minYear)
    }
  }

  function cycleSpeed(): void {
    speedIdx.value = (speedIdx.value + 1) % TIME_SPEEDS.length
  }
  function toggleReversed(): void {
    reversed.value = !reversed.value
  }
  function toggleLooping(): void {
    looping.value = !looping.value
  }

  // Data edits can move the range under an active scrub; project switches reset it.
  watch(range, (r) => {
    if (year.value == null) return
    if (!r) stop()
    else year.value = clamp(year.value)
  })
  watch(
    () => store.activeProjectId,
    () => stop()
  )

  return {
    year,
    playing,
    reversed,
    looping,
    speedIdx,
    active,
    gateYear,
    range,
    events,
    progress,
    setYear,
    play,
    pause,
    togglePlay,
    stop,
    stepYears,
    skipEvent,
    cycleSpeed,
    toggleReversed,
    toggleLooping
  }
}

let instance: TimeTravel | null = null

export function useTimeTravel(): TimeTravel {
  if (!instance) {
    const scope = effectScope(true) // detached: outlives any single component
    instance = scope.run(create) as TimeTravel
  }
  return instance
}
