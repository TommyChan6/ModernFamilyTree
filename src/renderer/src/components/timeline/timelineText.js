// Display text for the Timeline canvases, formatted in the UI language at draw
// time. The pure layout (timelineLayout.js) emits raw numbers plus English
// fallbacks; the renderers call these instead of drawing those strings.
import { translate } from '../../i18n'

/** A lane's name ('Unnamed' when the person has none). */
export function lifeName(p) {
  return p.unnamed ? translate('timeline.canvas.unnamed') : p.name
}

/** "1900–1970 · 70 yr" / "b. 1950 · 75 yr" under a lane's name. */
export function lifeYears(p) {
  if (p.age == null || p.bYear == null) return p.yearsLabel
  return p.dYear != null
    ? translate('timeline.canvas.yearsDead', { b: p.bYear, d: p.dYear, age: p.age })
    : translate('timeline.canvas.yearsLiving', { b: p.bYear, age: p.age })
}

/** A marriage badge: its year, or the "add year" prompt when estimated. */
export function badgeText(m) {
  return m.estimated ? translate('timeline.canvas.addYear') : m.badge
}

/** The open end of a span ("1990 – now"). */
export function nowText() {
  return translate('timeline.canvas.now')
}
