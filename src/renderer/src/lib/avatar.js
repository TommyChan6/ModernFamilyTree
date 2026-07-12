// Account avatar colouring, shared by the topbar chip and the profile page.
// Each account gets a stable hue derived from its username; the user can pin
// an explicit hue from the profile page (user.avatar_hue) which wins over the
// derived one.

/** Stable 0–359 hue from a username (same hash the account chip always used). */
export function derivedHue(username) {
  const name = username || ''
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return ((hash % 360) + 360) % 360
}

/** The hue to actually show: the user's explicit pick, else the derived one. */
export function avatarHue(user) {
  return user?.avatar_hue ?? derivedHue(user?.username)
}

export function gradientForHue(hue) {
  return `linear-gradient(135deg, hsl(${hue}, 62%, 52%), hsl(${(hue + 40) % 360}, 62%, 42%))`
}

/** Ready-to-bind style object for an avatar element. */
export function avatarStyleFor(user) {
  return { background: gradientForHue(avatarHue(user)) }
}
