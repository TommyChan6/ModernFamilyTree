// Observability seam — Sentry (errors) + PostHog (analytics) stubs.
//
// Step 0 of the web migration (docs/MID_DEVELOPMENT.md §7): the app reports
// errors and product events through this module *now*, so when the web build
// ships we swap the real SDKs in here and nothing else changes. Everything is
// a silent no-op in dev, and stays a no-op in prod until a DSN / API key is
// provided via env (VITE_SENTRY_DSN / VITE_POSTHOG_KEY).

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || ''
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || ''

const sentryEnabled = import.meta.env.PROD && !!SENTRY_DSN
const posthogEnabled = import.meta.env.PROD && !!POSTHOG_KEY

export const sentry = {
  init() {
    if (!sentryEnabled) return
    // TODO(web migration): import * as Sentry from '@sentry/vue'; Sentry.init({ dsn: SENTRY_DSN, ... })
  },

  /** Report a caught exception. `context` is arbitrary extra data. */
  captureException(_err, _context = {}) {
    if (!sentryEnabled) return
    // TODO(web migration): Sentry.captureException(_err, { extra: _context })
  },

  /** Report a message without an exception (level: 'info' | 'warning' | 'error'). */
  captureMessage(_message, _level = 'info') {
    if (!sentryEnabled) return
    // TODO(web migration): Sentry.captureMessage(_message, _level)
  }
}

export const posthog = {
  init() {
    if (!posthogEnabled) return
    // TODO(web migration): import posthog from 'posthog-js'; posthog.init(POSTHOG_KEY, { ... })
  },

  /** Track a product event, e.g. capture('person_created', { view: 'tree' }). */
  capture(_event, _properties = {}) {
    if (!posthogEnabled) return
    // TODO(web migration): posthog.capture(_event, _properties)
  },

  /** Associate events with a user once accounts exist. */
  identify(_userId, _properties = {}) {
    if (!posthogEnabled) return
    // TODO(web migration): posthog.identify(_userId, _properties)
  }
}

/**
 * Install global error reporting on the Vue app. Errors still reach the
 * console exactly as before — the stubs only add a reporting hook.
 */
export function initObservability(app) {
  sentry.init()
  posthog.init()

  app.config.errorHandler = (err, _instance, info) => {
    console.error(err)
    sentry.captureException(err, { vueInfo: info })
  }

  window.addEventListener('error', (e) => {
    sentry.captureException(e.error ?? e.message)
  })

  window.addEventListener('unhandledrejection', (e) => {
    sentry.captureException(e.reason)
  })
}
