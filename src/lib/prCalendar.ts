export type PrEntryKind = 'publication' | 'shooting' | 'other'
export type PrEntryStatus = 'draft' | 'planned' | 'in_progress' | 'ready' | 'completed' | 'cancelled'

export const PR_ENTRY_KINDS: Array<{ value: PrEntryKind; label: string }> = [
  { value: 'publication', label: 'Yayın' },
  { value: 'shooting', label: 'Çekim' },
  { value: 'other', label: 'Diğer' },
]

export const PR_ENTRY_STATUSES: Array<{ value: PrEntryStatus; label: string }> = [
  { value: 'draft', label: 'Taslak' },
  { value: 'planned', label: 'Planlandı' },
  { value: 'in_progress', label: 'Devam ediyor' },
  { value: 'ready', label: 'Hazır' },
  { value: 'completed', label: 'Tamamlandı' },
  { value: 'cancelled', label: 'İptal' },
]

export const PR_COLOR_PRESETS = ['#166534', '#0f766e', '#0369a1', '#7c3aed', '#b45309', '#be123c']

export function dateKeyInIstanbul(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date)
}

export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

export function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDays(value: string, days: number): string {
  const date = parseDateOnly(value)
  date.setUTCDate(date.getUTCDate() + days)
  return dateKey(date)
}

export function mondayOfWeek(value: string): string {
  const date = parseDateOnly(value)
  const offset = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - offset)
  return dateKey(date)
}

export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
}

export function monthStart(value: string): string {
  const date = parseDateOnly(value)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`
}

export function shiftMonth(value: string, amount: number): string {
  const date = parseDateOnly(monthStart(value))
  date.setUTCMonth(date.getUTCMonth() + amount)
  return monthStart(dateKey(date))
}

export function isSafeExternalUrl(value: string | null | undefined): boolean {
  if (!value) return true
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value)
}

export function formatOptionalTime(value: string | null): string {
  return value ? value.slice(0, 5) : 'Saat belirtilmedi'
}
