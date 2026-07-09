// Latest year appearing anywhere in the tree data. Used as the temporary
// "current year" when the user hasn't set one explicitly: it tracks the newest
// birth/death year on any person and the newest relationship formed date.
// Returns null when the data carries no usable year at all (e.g. a brand-new
// empty project, so the current year stays empty until the first dated person).
export function latestDataYear(persons = [], relationships = []) {
  let max = null
  const consider = (v) => {
    const y = typeof v === 'number' ? v : parseInt(v, 10)
    if (Number.isFinite(y) && y > 0 && (max === null || y > max)) max = y
  }
  for (const p of persons) { consider(p.birth_year); consider(p.death_year) }
  for (const r of relationships) consider(r.formed_date)
  return max
}
