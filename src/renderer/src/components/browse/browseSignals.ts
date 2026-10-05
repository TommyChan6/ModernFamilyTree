// The viewer's Browse-page activity: likes, saves, follows, recently opened
// trees, grafts, grove requests and their own comments. It feeds the
// recommendations and the card/profile states.
//
// Community data is mock until the hosted backend lands, so this is a
// per-viewer convenience kept in localStorage (keyed by account, every access
// wrapped — private windows may refuse storage). When real browsing arrives
// these become server rows; the shape here is what they should carry.

import { reactive, watch } from 'vue'

export type GroveStatus = 'pending' | 'member'
export interface MyComment {
  text: string
  at: number // epoch ms
}
export interface BrowseSignalsState {
  liked: string[]
  saved: string[]
  viewed: string[] // most recent first, capped
  followed: string[]
  /** mock project id → the real project id its graft created */
  grafts: Record<string, string>
  grove: Record<string, GroveStatus>
  comments: Record<string, MyComment[]>
}

const VIEWED_CAP = 12
const empty = (): BrowseSignalsState => ({
  liked: [],
  saved: [],
  viewed: [],
  followed: [],
  grafts: {},
  grove: {},
  comments: {}
})

function load(key: string): BrowseSignalsState {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return { ...empty(), ...JSON.parse(raw) }
  } catch {
    /* unavailable or corrupt — start fresh */
  }
  return empty()
}

const cache = new Map<string, ReturnType<typeof create>>()

function create(userId: string) {
  const key = `browse:signals:${userId}`
  const state = reactive(load(key))
  watch(
    state,
    (v) => {
      try {
        localStorage.setItem(key, JSON.stringify(v))
      } catch {
        /* storage full / blocked — keep the in-memory copy */
      }
    },
    { deep: true }
  )
  const toggleIn = (list: string[], id: string): boolean => {
    const i = list.indexOf(id)
    if (i === -1) list.unshift(id)
    else list.splice(i, 1)
    return i === -1
  }
  return {
    state,
    isLiked: (id: string) => state.liked.includes(id),
    isSaved: (id: string) => state.saved.includes(id),
    isFollowing: (id: string) => state.followed.includes(id),
    toggleLike: (id: string) => toggleIn(state.liked, id),
    toggleSave: (id: string) => toggleIn(state.saved, id),
    toggleFollow: (id: string) => toggleIn(state.followed, id),
    markViewed(id: string) {
      const i = state.viewed.indexOf(id)
      if (i !== -1) state.viewed.splice(i, 1)
      state.viewed.unshift(id)
      state.viewed.splice(VIEWED_CAP)
    },
    setGraft(id: string, projectId: string) {
      state.grafts[id] = projectId
    },
    setGrove(id: string, status: GroveStatus) {
      state.grove[id] = status
    },
    addComment(id: string, text: string) {
      const list = state.comments[id] || (state.comments[id] = [])
      list.push({ text, at: Date.now() })
    }
  }
}

export type BrowseSignals = ReturnType<typeof create>

/** One shared signals store per account (the Browse page and its dialogs
 *  all read the same reactive state). */
export function useBrowseSignals(userId: string): BrowseSignals {
  let s = cache.get(userId)
  if (!s) {
    s = create(userId)
    cache.set(userId, s)
  }
  return s
}
