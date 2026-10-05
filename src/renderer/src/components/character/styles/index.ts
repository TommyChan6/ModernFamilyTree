// The style-pack registry: every art style the Character view offers, in
// picker order. Docs reference a pack by `style_id`; unknown ids fall back to
// the first pack so an old or foreign look still renders.

import type { StylePack } from '../styleTypes'
import { animePack } from './anime'
import { cartoonPack } from './cartoon'
import { simplePack } from './simple'
import { realisticPack } from './realistic'

export const STYLE_LIST: StylePack[] = [animePack, realisticPack, simplePack, cartoonPack]

export const stylePacks: Record<string, StylePack> = Object.fromEntries(
  STYLE_LIST.map((p) => [p.id, p])
)

/** The pack for a style id (falls back to the default style). */
export function packOf(id: string | undefined | null): StylePack {
  return (id && stylePacks[id]) || STYLE_LIST[0]
}

/** The style new looks start in. */
export const DEFAULT_STYLE = STYLE_LIST[0].id
