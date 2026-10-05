// The kinship naming language — its own choice, independent of the UI
// language (an English UI can still name relatives in Chinese or Norwegian).
// Follows the app locale until the viewer picks one; the pick is a per-viewer
// convenience, remembered in localStorage.
import { ref, watch } from 'vue'
import { locale } from '../../i18n'
import type { KinLang } from './kinshipNames'

const KEY = 'familytree.kinshipLang'
const VALID: KinLang[] = ['en', 'no', 'zh-Hans', 'zh-Hant']

function fromLocale(l: string): KinLang {
  return (VALID as string[]).includes(l) ? (l as KinLang) : 'en'
}

function load(): KinLang | null {
  try {
    const v = localStorage.getItem(KEY)
    return v && (VALID as string[]).includes(v) ? (v as KinLang) : null
  } catch {
    return null
  }
}

const picked = ref<KinLang | null>(load())
export const kinLang = ref<KinLang>(picked.value || fromLocale(locale.value))

watch(locale, (l) => {
  if (!picked.value) kinLang.value = fromLocale(l)
})

export function setKinLang(l: KinLang) {
  picked.value = l
  kinLang.value = l
  try {
    localStorage.setItem(KEY, l)
  } catch {
    /* private mode — the choice just isn't remembered */
  }
}
