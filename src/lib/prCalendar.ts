export type PrEntryKind = 'publication' | 'shooting' | 'other'
export type PrEntryStatus = 'draft' | 'planned' | 'in_progress' | 'ready' | 'completed' | 'cancelled'
export interface PrReferenceLink { id: string; label: string; url: string }

export interface PrEntryAssignee {
  profileId: string
  assignmentSource: 'manual' | 'event_owner' | 'awareness_responsible'
}

export function extractManualAssignees(assignees: unknown): string[] {
  if (!Array.isArray(assignees)) return []
  return assignees
    .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object')
    .filter((a) => a.assignment_source === 'manual' && typeof a.profile_id === 'string')
    .map((a) => a.profile_id as string)
}

export function extractAutoAssignees(assignees: unknown): Array<{ profileId: string; source: 'event_owner' | 'awareness_responsible' }> {
  if (!Array.isArray(assignees)) return []
  return assignees
    .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object')
    .filter((a) => (a.assignment_source === 'event_owner' || a.assignment_source === 'awareness_responsible') && typeof a.profile_id === 'string')
    .map((a) => ({ profileId: a.profile_id as string, source: a.assignment_source as 'event_owner' | 'awareness_responsible' }))
}

export const MAX_PR_REFERENCE_LINKS = 20

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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(NaN)
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.toISOString().slice(0, 10) === value ? date : new Date(NaN)
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

export function formatWeekRange(weekStart: string): string {
  const start = parseDateOnly(weekStart)
  const end = parseDateOnly(addDays(weekStart, 6))
  const startDay = start.getUTCDate()
  const endDay = end.getUTCDate()
  const startMonth = new Intl.DateTimeFormat('tr-TR', { month: 'long', timeZone: 'UTC' }).format(start)
  const endMonth = new Intl.DateTimeFormat('tr-TR', { month: 'long', timeZone: 'UTC' }).format(end)
  const startYear = start.getUTCFullYear()
  const endYear = end.getUTCFullYear()

  if (startYear !== endYear) return `${startDay} ${startMonth} ${startYear} – ${endDay} ${endMonth} ${endYear}`
  if (start.getUTCMonth() !== end.getUTCMonth()) return `${startDay} ${startMonth} – ${endDay} ${endMonth} ${endYear}`
  return `${startDay} – ${endDay} ${endMonth} ${endYear}`
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

export function parsePrReferenceLinks(value: unknown, legacyLabel?: string | null, legacyUrl?: string | null): PrReferenceLink[] {
  if (Array.isArray(value)) {
    const parsed = value.flatMap((item, index) => {
      if (!item || typeof item !== 'object') return []
      const candidate = item as Record<string, unknown>
      if (typeof candidate.label !== 'string' || typeof candidate.url !== 'string') return []
      const label = candidate.label.trim()
      const url = candidate.url.trim()
      if (!label || !url || !isSafeExternalUrl(url)) return []
      return [{ id: typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id : `stored-link-${index}`, label, url }]
    })
    if (parsed.length > 0) return parsed.slice(0, MAX_PR_REFERENCE_LINKS)
  }

  const url = legacyUrl?.trim()
  if (!url || !isSafeExternalUrl(url)) return []
  return [{ id: 'legacy-reference-link', label: legacyLabel?.trim() || 'Harici bağlantı', url }]
}

export function normalizePrReferenceLinks(links: PrReferenceLink[]): PrReferenceLink[] {
  return links
    .map((link) => ({ id: link.id.trim(), label: link.label.trim(), url: link.url.trim() }))
    .filter((link) => link.label || link.url)
}

export function validatePrReferenceLinks(links: PrReferenceLink[]): string | null {
  const normalized = links.map((link) => ({ id: link.id.trim(), label: link.label.trim(), url: link.url.trim() }))
  if (normalized.length > MAX_PR_REFERENCE_LINKS) return `En fazla ${MAX_PR_REFERENCE_LINKS} bağlantı ekleyebilirsiniz.`

  for (const [index, link] of normalized.entries()) {
    const position = index + 1
    if (!link.id) return `${position}. bağlantının kimliği eksik.`
    if (!link.label) return `${position}. bağlantı için bir ad girin.`
    if (link.label.length > 160) return `${position}. bağlantı adı en fazla 160 karakter olabilir.`
    if (!link.url) return `${position}. bağlantı için bir adres girin.`
    if (link.url.length > 2048) return `${position}. bağlantı adresi en fazla 2048 karakter olabilir.`
    if (!isSafeExternalUrl(link.url)) return `${position}. bağlantı http:// veya https:// ile başlamalı.`
  }

  const ids = normalized.map((link) => link.id.toLocaleLowerCase('tr'))
  if (new Set(ids).size !== ids.length) return 'Bağlantı kimlikleri benzersiz olmalı.'
  const urls = normalized.map((link) => link.url.toLocaleLowerCase('tr'))
  if (new Set(urls).size !== urls.length) return 'Aynı bağlantı adresini birden fazla kez ekleyemezsiniz.'
  return null
}

export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value)
}

export function formatOptionalTime(value: string | null): string {
  return value ? value.slice(0, 5) : 'Saat belirtilmedi'
}

export function computeLegacyResponsibleId(currentResponsibleId: string | null | undefined, newManualAssigneeIds: string[]): string | null {
  if (currentResponsibleId && newManualAssigneeIds.includes(currentResponsibleId)) {
    return currentResponsibleId
  }
  return newManualAssigneeIds.length > 0 ? newManualAssigneeIds[0] : null
}

export function buildNonManagerPayload(draft: any, referenceLinks: PrReferenceLink[]) {
  const firstReferenceLink = referenceLinks[0]
  return {
    title: draft.title.trim(),
    entry_kind: draft.entryKind,
    scheduled_date: draft.scheduledDate,
    scheduled_time: draft.scheduledTime || null,
    color: draft.color,
    status: draft.status,
    channels: draft.channels,
    channel: draft.channels[0] ?? null,
    format: draft.format.trim() || null,
    notes: draft.notes.trim() || null,
    reference_links: referenceLinks,
    reference_label: firstReferenceLink?.label ?? null,
    reference_url: firstReferenceLink?.url ?? null,
  }
}
