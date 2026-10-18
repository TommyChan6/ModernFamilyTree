// Program metadata — the ONE place the app's version, creator, contact address
// and copyright line live. The About panel, the feedback mailto, and the home
// page's contact links all read from here, so changing the contact email (or
// cutting a release) is a one-line edit.

// Injected at build time from package.json `version` (see `define` in
// electron.vite.config.js / vite.config.web.js / vitest.config.js).
declare const __APP_VERSION__: string

export const APP_NAME = 'Family Tree'
export const APP_VERSION: string =
  typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0-dev'

export const CREATOR_NAME = 'Tommy Chan'
export const CONTACT_EMAIL = 'timmy.chan@helthjem.no'

export const COPYRIGHT_YEAR = 2026
/** "© 2026 Tommy Chan" — localized surroundings come from `about.copyright`. */
export const COPYRIGHT_HOLDER = `© ${COPYRIGHT_YEAR} ${CREATOR_NAME}`

/** A `mailto:` link to the contact address with a pre-filled subject (and body). */
export function contactMailto(subject: string, body?: string): string {
  let href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`
  if (body) href += `&body=${encodeURIComponent(body)}`
  return href
}
