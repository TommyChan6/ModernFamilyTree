// Latest year appearing anywhere in the project data. Used as the temporary
// "current year" when the user hasn't set one explicitly: it tracks the newest
// birth/death date on any person and the newest relationship formed date.
// Returns null when the data carries no usable year at all (e.g. a brand-new
// empty project, so the current year stays empty until the first dated person).
export function latestDataYear(persons = [], relationships = []) {
  let max = null
  const consider = (date) => {
    const y = date?.year
    if (Number.isFinite(y) && y > 0 && (max === null || y > max)) max = y
  }
  for (const p of persons) {
    consider(p.birth)
    consider(p.death)
  }
  for (const r of relationships) consider(r.formed)
  return max
}
