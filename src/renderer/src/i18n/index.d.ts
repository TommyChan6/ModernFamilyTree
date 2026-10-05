// Types for the JS i18n module so TypeScript callers can import it.
import type { Ref } from 'vue'

export const locale: Ref<string>
export const SUPPORTED_LOCALES: { code: string; label: string; native: string }[]
export function isSupportedLocale(code: string): boolean
export function setLocale(code: string): void
export function translate(key: string, params?: Record<string, unknown>): string
export function useI18n(): {
  t: typeof translate
  locale: Ref<string>
  setLocale: typeof setLocale
  SUPPORTED_LOCALES: typeof SUPPORTED_LOCALES
}
