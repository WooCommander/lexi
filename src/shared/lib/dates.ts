const DAY_MS = 24 * 60 * 60 * 1000

export const startOfDay = (date: Date): Date => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export const addDays = (date: Date, days: number): Date => {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/** Разница в календарных днях (b − a), без учёта времени суток. */
export const daysBetween = (a: Date, b: Date): number =>
  Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS)

/** YYYY-MM-DD в локальном часовом поясе. */
export const toISODate = (date: Date): string => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Разбор YYYY-MM-DD как локальной даты (new Date('2024-01-02') даёт UTC). */
export const parseISODate = (value: string): Date => {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export const formatDate = (value: string | Date | null | undefined): string => {
  if (!value) return '—'
  const date = typeof value === 'string' && value.length === 10 ? parseISODate(value) : new Date(value)
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export const formatShortDate = (value: string | Date): string => {
  const date = typeof value === 'string' && value.length === 10 ? parseISODate(value) : new Date(value)
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}
