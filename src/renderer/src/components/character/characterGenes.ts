// Character genetics + DNA share codes — pure functions over CharacterDocs.
//
// inheritDoc(): a child's face from its parents' looks. Facial slots are
// "genes" (each picked from one parent, or a wildcard mutation), skin blends
// between the parents, hair/eye colors are inherited with a little drift;
// clothing stays the child's own. A resemblance knob runs identical ↔ wild.
//
// encodeDNA()/decodeDNA(): a look as a compact copy-pasteable string, so
// characters move between projects/people with no server (zero-cost rule).
// Covered by tests/characterGenes.test.js.

import type { CharacterDoc, CharacterSlotState } from '../../../../shared/types'
import type { StylePack } from './styleTypes'
import { mixColor, partById, partsFor, swatchesFor } from './characterModel'

/** Slots passed down by blood (everything else — clothing, beards, hats —
 *  stays the child's own). */
export const GENE_SLOTS = ['head', 'hair', 'eyes', 'brows', 'nose', 'mouth', 'marks']

type Look = Pick<CharacterDoc, 'parts' | 'palette' | 'morph'> & { style_id?: string }

export interface InheritOptions {
  /** 1 = a faithful mix of the parents, 0 = mostly mutations. */
  resemblance?: number
  rng?: () => number
}

/** Blend 1–2 parent looks into a child look (in `pack`'s style). `base`
 *  supplies what isn't inherited (clothing, accessories, age). */
export function inheritDoc(
  pack: StylePack,
  parents: Look[],
  base: Look,
  opts: InheritOptions = {}
): Pick<CharacterDoc, 'parts' | 'palette' | 'morph'> {
  const rng = opts.rng ?? Math.random
  const resemblance = Math.max(0, Math.min(1, opts.resemblance ?? 0.8))
  const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)]
  const ps = parents.length ? parents : [base]

  const parts: Record<string, CharacterSlotState> = { ...base.parts }
  for (const s of pack.slots) {
    if (!GENE_SLOTS.includes(s.id)) continue
    const mutate = rng() > resemblance
    const parent = pick(ps)
    const candidate = parent.parts[s.id]?.partId
    const valid =
      candidate === null ? !!s.optional : !!candidate && partById(pack, candidate)?.slot === s.id
    if (!mutate && candidate !== undefined && valid) {
      parts[s.id] = { partId: candidate, scale: parent.parts[s.id]?.scale ?? 1 }
    } else {
      const options = partsFor(pack, s.id).filter(
        (p) => !['eyes-closed', 'mouth-open', 'brows-angry', 'brows-sad'].includes(p.id)
      )
      const keepNone = s.optional && rng() < 0.55
      parts[s.id] = {
        partId: keepNone || !options.length ? null : pick(options).id,
        scale: 1
      }
    }
  }

  // Colors: skin blends, hair and eyes come from one side (with drift)
  const a = ps[0].palette
  const b = (ps[1] ?? ps[0]).palette
  const drift = (1 - resemblance) * 0.5
  const skin = mixColor(a.skin || base.palette.skin, b.skin || base.palette.skin, 0.3 + rng() * 0.4)
  const hairFrom = rng() < 0.5 ? a : b
  const eyesFrom = rng() < 0.5 ? a : b
  const wild = (ch: string, color: string) => (rng() < drift ? pick(swatchesFor(pack, ch)) : color)
  const palette = {
    ...base.palette,
    skin,
    hair: wild(
      'hair',
      mixColor(
        hairFrom.hair || base.palette.hair,
        (hairFrom === a ? b : a).hair || base.palette.hair,
        rng() * 0.25
      )
    ),
    eyes: wild('eyes', eyesFrom.eyes || base.palette.eyes)
  }

  // Body: the parents' average plus a little noise
  const avg = (k: 'height' | 'build' | 'headSize') =>
    ps.reduce((sum, p) => sum + (p.morph?.[k] || 0), 0) / ps.length
  const noise = () => (rng() * 2 - 1) * (0.15 + 0.35 * (1 - resemblance))
  const clamp = (v: number) => Math.round(Math.max(-1, Math.min(1, v)) * 100) / 100
  const morph = {
    height: clamp(avg('height') + noise()),
    build: clamp(avg('build') + noise()),
    headSize: clamp(avg('headSize') + noise()),
    age: base.morph?.age ?? 0
  }
  return { parts, palette, morph }
}

// ── DNA share codes ───────────────────────────────────────────────────────────
const PREFIX = 'FTC1.'

export interface DNA {
  style_id: string
  parts: Record<string, CharacterSlotState>
  palette: Record<string, string>
  morph: CharacterDoc['morph']
  expression?: string
  backdrop?: string
}

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): string {
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : ''
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

/** A look → a compact share string ("FTC1.…"). */
export function encodeDNA(doc: DNA): string {
  const compact = {
    s: doc.style_id,
    p: Object.entries(doc.parts).map(([slot, st]) => [
      slot,
      st.partId,
      Math.round((st.scale ?? 1) * 100) / 100,
      st.flip ? 1 : 0
    ]),
    c: doc.palette,
    m: doc.morph,
    e: doc.expression || undefined,
    b: doc.backdrop || undefined
  }
  return PREFIX + toBase64Url(JSON.stringify(compact))
}

const HEX = /^#[0-9a-f]{6}$/i

/** Parse a share string; throws on anything malformed. Unknown part ids are
 *  kept (the renderer falls back per slot), colors must be #rrggbb. */
export function decodeDNA(code: string): DNA {
  const raw = code.trim()
  if (!raw.startsWith(PREFIX)) throw new Error('Not a character code')
  let data: Record<string, unknown>
  try {
    data = JSON.parse(fromBase64Url(raw.slice(PREFIX.length)))
  } catch {
    throw new Error('Corrupted character code')
  }
  if (typeof data.s !== 'string' || !Array.isArray(data.p))
    throw new Error('Corrupted character code')
  const parts: Record<string, CharacterSlotState> = {}
  for (const row of data.p as unknown[]) {
    if (!Array.isArray(row) || typeof row[0] !== 'string') continue
    const [slot, partId, scale, flip] = row
    parts[slot] = {
      partId: typeof partId === 'string' ? partId : null,
      scale: typeof scale === 'number' && scale > 0.2 && scale < 3 ? scale : 1,
      ...(flip ? { flip: true } : {})
    }
  }
  const palette: Record<string, string> = {}
  for (const [k, v] of Object.entries((data.c as Record<string, unknown>) || {})) {
    if (typeof v === 'string' && HEX.test(v)) palette[k] = v.toLowerCase()
  }
  const m = (data.m as Record<string, unknown>) || {}
  const num = (v: unknown) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0
  return {
    style_id: data.s,
    parts,
    palette,
    morph: {
      height: num(m.height),
      build: num(m.build),
      headSize: num(m.headSize),
      age: num(m.age)
    },
    expression: typeof data.e === 'string' ? data.e : undefined,
    backdrop: typeof data.b === 'string' ? data.b : undefined
  }
}
