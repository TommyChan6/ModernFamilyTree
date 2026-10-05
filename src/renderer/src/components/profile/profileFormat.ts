// Small formatting helpers shared by every profile presentation
// (PersonModal's cinematic page and the ProfileScroll handscroll).

export interface DateValueLike {
  year?: number | null
  month?: number | null
  day?: number | null
  precision?: string | null
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function fmtDate(dv: DateValueLike | null | undefined): string {
  if (!dv || dv.year == null) return ''
  const m = dv.month
  if (dv.precision === 'day' && m && dv.day) return `${dv.day} ${MONTHS[m - 1]} ${dv.year}`
  if ((dv.precision === 'day' || dv.precision === 'month') && m)
    return `${MONTHS[m - 1]} ${dv.year}`
  return String(dv.year)
}

export function dateOrd(dv: DateValueLike | null | undefined): number | null {
  if (!dv || dv.year == null) return null
  return dv.year + ((dv.month || 1) - 1) / 12 + ((dv.day || 1) - 1) / 372
}

export function initialsOf(name: string | null | undefined): string {
  const parts = (name || '?').trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (parts[0] || '?').substring(0, 2).toUpperCase()
}
