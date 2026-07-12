// Lightweight, dependency-free i18n for the renderer.
//
// The project keeps its dependency surface small (no vue-i18n), so this is a
// tiny reactive translation layer: a single reactive `locale` ref plus a
// `t(key)` lookup that walks a dotted key path into the active locale's
// message tree, falling back to English and finally to the raw key. Because
// `t()` reads `locale.value` on every call, using it inside a template makes
// that template re-render when the language changes — the whole UI re-localises
// live with no reload.
import { ref } from 'vue'
import en from './locales/en.js'
import zhHans from './locales/zh-Hans.js'
import zhHant from './locales/zh-Hant.js'

const messages = {
  en,
  'zh-Hans': zhHans,
  'zh-Hant': zhHant
}

// Advertised in the Settings > Language picker. `native` is shown in the
// language's own script so speakers can find it without reading English.
export const SUPPORTED_LOCALES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'zh-Hans', label: 'Simplified Chinese', native: '简体中文' },
  { code: 'zh-Hant', label: 'Traditional Chinese', native: '繁體中文' }
]

const DEFAULT_LOCALE = 'en'
export const locale = ref(DEFAULT_LOCALE)

export function isSupportedLocale(code) {
  return Object.prototype.hasOwnProperty.call(messages, code)
}

export function setLocale(code) {
  if (isSupportedLocale(code)) {
    locale.value = code
    document.documentElement.setAttribute('lang', code)
  }
}

function lookup(tree, path) {
  return path.split('.').reduce((node, key) => (node == null ? undefined : node[key]), tree)
}

// Translate a dotted key. `params` values interpolate into `{name}` tokens.
// Non-string results (arrays / objects used for lists) are returned as-is so
// callers can iterate structured help content.
export function translate(key, params) {
  const active = messages[locale.value] || messages[DEFAULT_LOCALE]
  let value = lookup(active, key)
  if (value === undefined) value = lookup(messages[DEFAULT_LOCALE], key)
  if (value === undefined) return key
  if (typeof value === 'string' && params) {
    return value.replace(/\{(\w+)\}/g, (m, name) => (name in params ? String(params[name]) : m))
  }
  return value
}

export function useI18n() {
  return { t: translate, locale, setLocale, SUPPORTED_LOCALES }
}
