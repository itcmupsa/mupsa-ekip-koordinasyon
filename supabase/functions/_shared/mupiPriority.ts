import type {
  DeterministicHomeSummaryDecision,
  DeterministicHomeSummaryItem,
  DeterministicHomeSummaryReasonCode,
  HomeSummaryAction,
  HomeSummaryBucket,
  HomeSummarySourceType,
  HomeSummaryUrgency,
} from './aiCore.ts'

type AnyRecord = Record<string, unknown>

interface BuildInput {
  context: AnyRecord
  summaryDate: string
}

const DAY_MS = 86_400_000
const COMPLETED_STATUSES = new Set(['completed', 'cancelled'])
const EVENT_DESIGN_READY = new Set(['ready', 'published', 'approved', 'completed'])
const EVENT_ANNOUNCEMENT_READY = new Set(['published', 'completed', 'done'])

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : {}
}

function asArray(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? value.map(asRecord) : []
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function parseDate(value: unknown): Date | null {
  const text = asString(value)
  if (!text) return null
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date
}

function dayStartUtc(dateText: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText)
  if (!match) throw new Error('summaryDate YYYY-MM-DD biciminde olmalidir.')
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

function datePartInIstanbul(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value)
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${map.year}-${map.month}-${map.day}`
}

function daysFromSummaryDate(date: Date, summaryDate: string): number {
  return Math.round((dayStartUtc(datePartInIstanbul(date)) - dayStartUtc(summaryDate)) / DAY_MS)
}

function actionFor(type: HomeSummarySourceType): HomeSummaryAction {
  if (type === 'task') return 'open_task'
  if (type === 'event') return 'open_event'
  if (type === 'awareness') return 'open_awareness'
  return 'open_calendar'
}

function routeFor(type: HomeSummarySourceType, id: string): string {
  if (type === 'task') return '/app/gorevler'
  if (type === 'event') return `/app/etkinlikler/${id}`
  if (type === 'awareness') return '/app/farkindalik'
  return '/app/takvim'
}

function makeItem(params: {
  alias: string
  entityType: HomeSummarySourceType
  entityId: string
  title: string
  reasonCode: DeterministicHomeSummaryReasonCode
  bucket: HomeSummaryBucket
  urgency: HomeSummaryUrgency
  score: number
  fallbackDetail: string
  facts?: Record<string, unknown>
}): DeterministicHomeSummaryItem {
  return {
    alias: params.alias,
    entityType: params.entityType,
    entityId: params.entityId,
    title: params.title,
    route: routeFor(params.entityType, params.entityId),
    reasonCode: params.reasonCode,
    action: actionFor(params.entityType),
    bucket: params.bucket,
    urgency: params.urgency,
    score: params.score,
    fallbackDetail: params.fallbackDetail,
    facts: params.facts ?? {},
  }
}

function priorityBonus(priority: string | null): number {
  if (priority === 'urgent') return 10
  if (priority === 'high') return 5
  if (priority === 'low') return -5
  return 0
}

function taskCandidate(row: AnyRecord, summaryDate: string, index: number): DeterministicHomeSummaryItem | null {
  const id = asString(row.source_id) ?? asString(row.id)
  const title = asString(row.title)
  const status = asString(row.progress_status) ?? asString(row.status)
  if (!id || !title || (status && COMPLETED_STATUSES.has(status))) return null

  const deadline = parseDate(row.deadline_at ?? row.deadline)
  const priority = asString(row.priority)
  if (!deadline) {
    if (priority !== 'urgent' && priority !== 'high') return null
    return makeItem({
      alias: asString(row.alias) ?? `T${index + 1}`,
      entityType: 'task', entityId: id, title,
      reasonCode: 'high_priority_task', bucket: 'upcoming', urgency: 'upcoming',
      score: 45 + priorityBonus(priority),
      fallbackDetail: 'Yuksek oncelikli acik gorev; son tarih belirtilmemis.',
      facts: { priority, status },
    })
  }

  const days = daysFromSummaryDate(deadline, summaryDate)
  const common = { alias: asString(row.alias) ?? `T${index + 1}`, entityType: 'task' as const, entityId: id, title, facts: { daysUntilDeadline: days, priority, status } }
  if (days < 0) return makeItem({ ...common, reasonCode: 'task_overdue', bucket: 'today', urgency: 'critical', score: 100 + priorityBonus(priority), fallbackDetail: `Son tarihi ${Math.abs(days)} gun gecmis.` })
  if (days === 0) return makeItem({ ...common, reasonCode: 'task_due_today', bucket: 'today', urgency: 'critical', score: 98 + priorityBonus(priority), fallbackDetail: 'Son tarih bugun.' })
  if (days === 1) return makeItem({ ...common, reasonCode: 'task_due_tomorrow', bucket: 'today', urgency: priority === 'urgent' || priority === 'high' ? 'critical' : 'action', score: 95 + priorityBonus(priority), fallbackDetail: 'Son tarih yarin; bugun ilerletilmesi gerekiyor.' })
  if (days <= 3) return makeItem({ ...common, reasonCode: 'task_due_2_3_days', bucket: 'today', urgency: 'action', score: 90 + priorityBonus(priority), fallbackDetail: `Son tarihe ${days} gun kaldi.` })
  if (days <= 7) return makeItem({ ...common, reasonCode: 'task_due_4_7_days', bucket: 'upcoming', urgency: 'upcoming', score: 70 + priorityBonus(priority), fallbackDetail: `Son tarihe ${days} gun kaldi.` })
  if (days <= 14) return makeItem({ ...common, reasonCode: 'task_due_8_14_days', bucket: 'upcoming', urgency: 'info', score: 45 + priorityBonus(priority), fallbackDetail: `Son tarihe ${days} gun kaldi.` })
  return null
}

function eventProcessMissing(row: AnyRecord): boolean {
  const design = asString(row.design_announcement_status ?? row.design_status)
  const announcement = asString(row.announcement_status ?? row.publication_status)
  const missingFields = Array.isArray(row.missing_fields) ? row.missing_fields.length > 0 : false
  const designMissing = design ? !EVENT_DESIGN_READY.has(design) : false
  const announcementMissing = announcement ? !EVENT_ANNOUNCEMENT_READY.has(announcement) : false
  return missingFields || designMissing || announcementMissing
}

function eventCandidate(row: AnyRecord, summaryDate: string, index: number): DeterministicHomeSummaryItem | null {
  const id = asString(row.source_id) ?? asString(row.id)
  const title = asString(row.title)
  const date = parseDate(row.effective_date ?? row.confirmed_date ?? row.estimated_date ?? row.event_date ?? row.starts_at)
  if (!id || !title || !date) return null
  const days = daysFromSummaryDate(date, summaryDate)
  const reportStatus = asString(row.report_status)
  const lifecyclePhase = asString(row.lifecycle_phase)

  const facts = {
    daysUntilEvent: days,
    designStatus: asString(row.design_announcement_status ?? row.design_status),
    announcementStatus: asString(row.announcement_status ?? row.publication_status),
    missingFields: row.missing_fields ?? [],
    sksStatus: asString(row.sks_status),
    reportStatus,
    lifecyclePhase,
  }
  const common = { alias: asString(row.alias) ?? `E${index + 1}`, entityType: 'event' as const, entityId: id, title, facts }

  if (days < 0) {
    if (lifecyclePhase === 'report_due' && reportStatus !== 'yes') {
      return makeItem({
        ...common,
        reasonCode: 'event_report_due',
        bucket: 'today',
        urgency: 'action',
        score: 84,
        fallbackDetail: 'Etkinlik sonrasi rapor sureci artik kontrol edilmeli.',
      })
    }
    return null
  }
  if (days > 40) return null

  const missing = eventProcessMissing(row)
  if (days === 0) return makeItem({ ...common, reasonCode: 'event_day', bucket: 'today', urgency: 'critical', score: 99, fallbackDetail: 'Etkinlik bugun.' })
  if (days <= 2) return makeItem({ ...common, reasonCode: missing ? 'event_critical_preparation_missing' : 'event_final_days', bucket: 'today', urgency: missing ? 'critical' : 'action', score: missing ? 97 : 88, fallbackDetail: missing ? `Etkinlige ${days} gun kaldi ve hazirlikta eksik var.` : `Etkinlige ${days} gun kaldi.` })
  if (days <= 7) {
    if (!missing) return null
    return makeItem({ ...common, reasonCode: 'event_final_preparation_missing', bucket: 'today', urgency: 'action', score: 92, fallbackDetail: `Etkinlige ${days} gun kaldi ve hazirlik tamamlanmamis.` })
  }
  if (days <= 14) {
    if (!missing) return null
    return makeItem({ ...common, reasonCode: 'event_intensive_preparation_missing', bucket: 'upcoming', urgency: 'upcoming', score: 78, fallbackDetail: `Etkinlige ${days} gun kaldi; tasarim/duyuru sureci kontrol edilmeli.` })
  }
  if (days <= 21) {
    if (!missing) return null
    return makeItem({ ...common, reasonCode: 'event_active_preparation_missing', bucket: 'upcoming', urgency: 'upcoming', score: 63, fallbackDetail: `Etkinlige ${days} gun kaldi ve hazirlik surecinde eksik gorunuyor.` })
  }
  if (days <= 30) {
    if (!missing) return null
    return makeItem({ ...common, reasonCode: 'event_early_preparation', bucket: 'upcoming', urgency: 'info', score: 50, fallbackDetail: `Etkinlige ${days} gun kaldi; erken hazirlik eksikleri var.` })
  }
  return null
}

function awarenessCandidate(row: AnyRecord, summaryDate: string, index: number): DeterministicHomeSummaryItem | null {
  const id = asString(row.source_id) ?? asString(row.id)
  const title = asString(row.title) ?? asString(row.awareness_name)
  const date = parseDate(row.effective_date ?? row.share_date ?? row.estimated_date ?? row.publication_date)
  if (!id || !title || !date) return null
  const days = daysFromSummaryDate(date, summaryDate)
  const common = { alias: asString(row.alias) ?? `A${index + 1}`, entityType: 'awareness' as const, entityId: id, title, facts: { daysUntilShare: days, designStatus: row.design_status, sharingStatus: row.sharing_status, missingFields: row.missing_fields ?? [] } }
  if (days < 0) return makeItem({ ...common, reasonCode: 'awareness_share_overdue', bucket: 'today', urgency: 'critical', score: 96, fallbackDetail: `Paylasim tarihi ${Math.abs(days)} gun gecmis.` })
  if (days === 0) return makeItem({ ...common, reasonCode: 'awareness_share_today', bucket: 'today', urgency: 'critical', score: 94, fallbackDetail: 'Farkindalik paylasimi bugun.' })
  if (days <= 3) return makeItem({ ...common, reasonCode: 'awareness_final_preparation', bucket: 'today', urgency: 'action', score: 86, fallbackDetail: `Paylasima ${days} gun kaldi.` })
  if (days <= 10) return makeItem({ ...common, reasonCode: 'awareness_upcoming_preparation', bucket: 'upcoming', urgency: 'upcoming', score: 62, fallbackDetail: `Paylasima ${days} gun kaldi.` })
  return null
}

function calendarCandidate(row: AnyRecord, summaryDate: string, index: number): DeterministicHomeSummaryItem | null {
  const id = asString(row.source_id) ?? asString(row.id)
  const title = asString(row.title)
  const date = parseDate(row.start_date ?? row.starts_at ?? row.entry_date)
  if (!id || !title || !date) return null
  const days = daysFromSummaryDate(date, summaryDate)
  const common = { alias: asString(row.alias) ?? `C${index + 1}`, entityType: 'calendar_entry' as const, entityId: id, title, facts: { daysUntilEntry: days, entryType: row.entry_type } }
  if (days === 0) return makeItem({ ...common, reasonCode: 'calendar_today', bucket: 'today', urgency: 'action', score: 80, fallbackDetail: 'Takvim kaydi bugun.' })
  if (days >= 1 && days <= 7) return makeItem({ ...common, reasonCode: 'calendar_upcoming', bucket: 'upcoming', urgency: 'info', score: 40 - days, fallbackDetail: `Takvim kaydina ${days} gun kaldi.` })
  return null
}

function compareCandidates(a: DeterministicHomeSummaryItem, b: DeterministicHomeSummaryItem): number {
  const urgencyOrder: Record<HomeSummaryUrgency, number> = { critical: 4, action: 3, upcoming: 2, info: 1 }
  return urgencyOrder[b.urgency] - urgencyOrder[a.urgency]
    || b.score - a.score
    || a.title.localeCompare(b.title, 'tr')
    || a.entityId.localeCompare(b.entityId)
}

function uniqueByEntity(items: DeterministicHomeSummaryItem[]): DeterministicHomeSummaryItem[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${item.entityType}:${item.entityId}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function buildDeterministicHomeSummary({ context, summaryDate }: BuildInput): DeterministicHomeSummaryDecision {
  const tasks = asArray(context.tasks)
  const events = asArray(context.events)
  const awareness = asArray(context.awareness ?? context.awareness_posts)
  const calendar = asArray(context.calendar ?? context.calendar_entries)

  const candidates = [
    ...tasks.map((row, index) => taskCandidate(row, summaryDate, index)).filter(Boolean),
    ...events.map((row, index) => eventCandidate(row, summaryDate, index)).filter(Boolean),
    ...awareness.map((row, index) => awarenessCandidate(row, summaryDate, index)).filter(Boolean),
    ...calendar.map((row, index) => calendarCandidate(row, summaryDate, index)).filter(Boolean),
  ] as DeterministicHomeSummaryItem[]

  const today = uniqueByEntity(candidates.filter((item) => item.bucket === 'today').sort(compareCandidates)).slice(0, 3)
  const used = new Set(today.map((item) => `${item.entityType}:${item.entityId}`))
  const upcoming = uniqueByEntity(candidates
    .filter((item) => item.bucket === 'upcoming' && !used.has(`${item.entityType}:${item.entityId}`))
    .sort(compareCandidates))
    .slice(0, 3)

  return { summaryDate, today, upcoming }
}

export function fallbackCopy(item: DeterministicHomeSummaryItem): string {
  if (item.reasonCode === 'task_overdue') return `${item.title}: son tarih gecmis. Bugun ilerlet.`
  if (item.reasonCode === 'task_due_today') return `${item.title}: son tarih bugun.`
  if (item.reasonCode === 'task_due_tomorrow') return `${item.title}: yarin son gun; bugun ilerlet.`
  if (item.reasonCode === 'event_report_due') return `${item.title}: etkinlik sonrasi rapor durumunu kontrol et.`
  return `${item.title}: ${item.fallbackDetail}`
}
