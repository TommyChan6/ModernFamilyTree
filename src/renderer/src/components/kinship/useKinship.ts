// The shared kinship context for every surface that names relatives (graph
// lens + trace card, action pane, profile, quiz). One KinIndex per data
// change, one lens per anchor — cached until persons/relationships change.
import { computed, effectScope, type ComputedRef } from 'vue'
import { useMainStore } from '../../store/index.js'
import {
  buildKinIndex,
  kinshipLens,
  makeKinshipCoefficient,
  type Kin,
  type KinIndex,
  type KRel,
  type SymRole
} from './kinshipGraph'
import { kinName, type KinLang } from './kinshipNames'
import { kinLang, setKinLang } from './kinshipLang'

/** Visual classes the lens colours by. */
export type KinClass = 'self' | 'blood' | 'spouse' | 'marriage' | 'step' | 'social' | 'distant'

export function kinClass(k: Kin | null | undefined): KinClass | null {
  if (!k) return null
  switch (k.kind) {
    case 'self':
      return 'self'
    case 'blood':
      return 'blood'
    case 'spouse':
      return 'spouse'
    case 'inlaw':
    case 'affine':
    case 'coparent':
      return 'marriage'
    case 'step':
      return 'step'
    case 'social':
      return 'social'
    default:
      return 'distant'
  }
}

/** Canvas-side colours for the kin classes. They mirror the --kin-* design
 *  tokens in global.css (read live so a theme can retune them). */
const FALLBACK: Record<KinClass, string> = {
  self: '#6c8ef5',
  blood: '#f2b54a',
  spouse: '#f06292',
  marriage: '#4fc3c7',
  step: '#a98bff',
  social: '#6fcf97',
  distant: '#8a93a6'
}
export function kinPalette(): Record<KinClass, string> {
  const out = { ...FALLBACK }
  try {
    const cs = getComputedStyle(document.documentElement)
    for (const k of Object.keys(out) as KinClass[]) {
      const v = cs.getPropertyValue(k === 'self' ? '--accent' : `--kin-${k}`).trim()
      if (/^#[0-9a-f]{6}$/i.test(v)) out[k] = v
    }
  } catch {
    /* no DOM (tests) */
  }
  return out
}

interface KinshipCtx {
  index: ComputedRef<KinIndex>
  coef: ComputedRef<ReturnType<typeof makeKinshipCoefficient>>
  lensOf: (anchor: string | null | undefined) => Map<string, Kin>
  nameOf: (kin: Kin | null | undefined, anchor: string, target: string, lang?: KinLang) => string
  socialLabel: (rel: KRel, anchor: string) => string
  personName: (id: string | null | undefined) => string
  personColor: (id: string | null | undefined) => string
  kinLang: typeof kinLang
  setKinLang: typeof setKinLang
}

let shared: KinshipCtx | null = null

export function useKinship(): KinshipCtx {
  if (shared) return shared
  const store = useMainStore()
  const scope = effectScope(true)
  shared = scope.run(() => {
    const roleOf = (t: string): SymRole =>
      store.relTypeRoles?.size
        ? store.relTypeRoles.get(t) || 'none'
        : t === 'parent_child' || t === 'adopted'
          ? 'vertical'
          : t === 'spouse'
            ? 'horizontal'
            : 'none'

    const index = computed(() => buildKinIndex(store.persons, store.relationships, roleOf))
    const coef = computed(() => makeKinshipCoefficient(index.value))

    // Lens cache, dropped wholesale whenever the index rebuilds.
    let cacheFor: KinIndex | null = null
    const cache = new Map<string, Map<string, Kin>>()
    const lensOf = (anchor: string | null | undefined) => {
      const idx = index.value
      if (cacheFor !== idx) {
        cache.clear()
        cacheFor = idx
      }
      if (!anchor) return new Map<string, Kin>()
      let l = cache.get(anchor)
      if (!l) {
        l = kinshipLens(idx, anchor)
        if (cache.size > 24) cache.clear()
        cache.set(anchor, l)
      }
      return l
    }

    const socialLabel = (rel: KRel, anchor: string) => {
      const def = store.relTypeByKey?.get(rel.type)
      if (rel.label) return rel.label
      if (!def) return rel.type
      if (def.directed) {
        // The OTHER person's role, seen from the anchor.
        const role = rel.person_a_id === anchor ? def.role_b : def.role_a
        return role || def.label
      }
      return def.label
    }

    const nameOf = (
      kin: Kin | null | undefined,
      anchor: string,
      target: string,
      lang: KinLang = kinLang.value
    ) => kinName(kin, lang, { index: index.value, anchor, target, socialLabel })

    const byId = computed(() => new Map(store.persons.map((p: { id: string }) => [p.id, p])))
    const personName = (id: string | null | undefined) =>
      (id && (byId.value.get(id) as { name?: string } | undefined)?.name) || 'Unnamed'

    const hexMix = (a: string, b: string, t: number) => {
      const pa = parseInt(a.slice(1), 16)
      const pb = parseInt(b.slice(1), 16)
      const ch = (sh: number) =>
        Math.round(((pa >> sh) & 255) + (((pb >> sh) & 255) - ((pa >> sh) & 255)) * t)
      return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`
    }
    const personColor = (id: string | null | undefined) => {
      const g = store.graphSettings
      const p = id ? (byId.value.get(id) as { gender_t?: number | null; gender?: string }) : null
      if (!p) return 'var(--accent)'
      if (typeof p.gender_t === 'number') return hexMix(g.maleColor, g.femaleColor, p.gender_t)
      if (p.gender === 'male') return g.maleColor
      if (p.gender === 'female') return g.femaleColor
      return g.unknownColor || '#5c6bc0'
    }

    return {
      index,
      coef,
      lensOf,
      nameOf,
      socialLabel,
      personName,
      personColor,
      kinLang,
      setKinLang
    }
  })!
  return shared
}
