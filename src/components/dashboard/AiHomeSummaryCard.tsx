import { Link } from 'react-router-dom'

export interface AiHomeSummaryItem {
  source_ref: string
  source_type: 'task' | 'event' | 'awareness' | 'calendar_entry'
  source_id: string
  title: string
  reason_code: string
  recommendation: string
  action: 'open_task' | 'open_event' | 'open_awareness' | 'open_calendar'
  route: string
  urgency?: 'critical' | 'action' | 'upcoming' | 'info'
  score?: number
}

export interface AiHomeSummary {
  schema_version?: string
  summary_date?: string
  intro: string
  items: AiHomeSummaryItem[]
  today?: AiHomeSummaryItem[]
  upcoming?: AiHomeSummaryItem[]
  club_summary?: AiHomeSummary | null
}

interface AiHomeSummaryCardProps {
  summary: AiHomeSummary | null
  generatedAt: string | null
  loading: boolean
  error: string | null
  warning: string | null
  onRefresh?: () => void
  audienceLabel?: string
}

const TODAY_REASON_CODES = new Set([
  'task_overdue', 'task_due_today', 'task_due_tomorrow', 'task_due_2_3_days',
  'event_day', 'event_final_days', 'event_final_preparation_missing', 'event_critical_preparation_missing', 'event_report_due',
  'awareness_share_overdue', 'awareness_share_today', 'awareness_final_preparation',
  'calendar_today',
])

const UPCOMING_REASON_CODES = new Set([
  'task_due_4_7_days', 'task_due_8_14_days', 'high_priority_task',
  'event_preparation_started', 'event_early_preparation', 'event_active_preparation_missing', 'event_intensive_preparation_missing',
  'awareness_upcoming_preparation',
  'calendar_upcoming',
])

const reasonLabels: Record<string, string> = {
  task_created: 'Yeni görev',
  task_updated: 'Görev hareketi',
  task_completed: 'Tamamlanan görev',
  overdue_task: 'Geciken görev',
  due_soon_task: 'Yaklaşan son tarih',
  high_priority_task: 'Yüksek öncelik',
  assigned_open_task: 'Atanmış açık görev',
  open_task: 'Açık görev',
  task_overdue: 'Geciken görev',
  task_due_today: 'Son tarih bugün',
  task_due_tomorrow: 'Son tarih yarın',
  task_due_2_3_days: '2–3 gün kaldı',
  task_due_4_7_days: '4–7 gün kaldı',
  task_due_8_14_days: 'Yaklaşan görev',
  event_created: 'Yeni etkinlik',
  event_updated: 'Etkinlik hareketi',
  missing_event_field: 'Eksik etkinlik bilgisi',
  event_preparation_active: 'Hazırlık dönemi',
  event_preparation_started: 'Hazırlık başladı',
  event_early_preparation: 'Erken hazırlık',
  event_active_preparation_missing: 'Hazırlık eksiği',
  event_intensive_preparation_missing: 'Yoğun hazırlık eksiği',
  event_final_preparation_missing: 'Son hafta hazırlığı',
  event_critical_preparation_missing: 'Kritik hazırlık eksiği',
  event_final_days: 'Etkinliğe son günler',
  event_day: 'Etkinlik günü',
  event_report_due: 'Rapor zamanı',
  awareness_created: 'Yeni farkındalık',
  awareness_updated: 'Farkındalık hareketi',
  missing_awareness_field: 'Eksik farkındalık bilgisi',
  awareness_preparation_active: 'İçerik hazırlık dönemi',
  awareness_share_due_soon: 'Yaklaşan paylaşım',
  awareness_share_overdue: 'Paylaşım tarihi geçti',
  awareness_share_today: 'Paylaşım bugün',
  awareness_final_preparation: 'Son hazırlık',
  awareness_upcoming_preparation: 'Yaklaşan paylaşım',
  calendar_entry_created: 'Yeni takvim kaydı',
  calendar_entry_updated: 'Takvim hareketi',
  upcoming_calendar_entry: 'Yaklaşan takvim kaydı',
  calendar_today: 'Bugünün takvimi',
  calendar_upcoming: 'Yaklaşan takvim kaydı',
}

function formatGeneratedAt(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatSummaryDate(value: string | undefined): string | null {
  if (!value) return null
  const date = new Date(`${value}T12:00:00+03:00`)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatRecommendation(value: string): string {
  const fieldLabels: Record<string, string> = {
    venue: 'mekân',
    sks_status: 'SKS durumu',
    share_date: 'paylaşım tarihi',
    design_responsible: 'tasarım sorumlusu',
    publication_responsible: 'basın-yayın sorumlusu',
  }
  return Object.entries(fieldLabels).reduce(
    (text, [field, label]) => text.replace(new RegExp(`\\b${field}\\b`, 'g'), label),
    value,
  )
}

function actionLabel(item: AiHomeSummaryItem): string {
  if (item.source_type === 'task') return 'Göreve git'
  if (item.source_type === 'event') return 'Etkinliğe git'
  if (item.source_type === 'awareness') return 'Farkındalığa git'
  return 'Takvime git'
}

function looksLikeV2(summary: AiHomeSummary | null): boolean {
  if (!summary) return false
  if (summary.schema_version === 'mupi-daily-summary-v2' || summary.today || summary.upcoming) return true
  return summary.items.some((item) => TODAY_REASON_CODES.has(item.reason_code) || UPCOMING_REASON_CODES.has(item.reason_code))
}

function splitV2Items(summary: AiHomeSummary): { today: AiHomeSummaryItem[]; upcoming: AiHomeSummaryItem[] } {
  if (summary.today || summary.upcoming) {
    return { today: summary.today ?? [], upcoming: summary.upcoming ?? [] }
  }
  return {
    today: summary.items.filter((item) => TODAY_REASON_CODES.has(item.reason_code)).slice(0, 3),
    upcoming: summary.items.filter((item) => UPCOMING_REASON_CODES.has(item.reason_code)).slice(0, 3),
  }
}

function SummaryList({ items }: { items: AiHomeSummaryItem[] }) {
  if (items.length === 0) return null
  return (
    <ul className="mt-2 divide-y divide-canvas-border">
      {items.slice(0, 3).map((item) => (
        <li key={`${item.source_type}-${item.source_id}`} className="flex min-w-0 flex-col gap-2 py-3 first:pt-2 last:pb-0 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="break-words text-sm font-semibold text-ink">{item.title}</p>
              <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold text-brand-dark">
                {reasonLabels[item.reason_code] ?? 'Öncelik'}
              </span>
            </div>
            <p className="mt-1 break-words text-sm leading-5 text-ink-soft">{formatRecommendation(item.recommendation)}</p>
          </div>
          <Link
            to={item.route}
            className="inline-flex min-h-[36px] shrink-0 items-center self-start rounded-lg px-2.5 py-2 text-sm font-semibold text-brand-dark hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 sm:self-auto"
          >
            {actionLabel(item)} <span className="ml-1" aria-hidden="true">›</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default function AiHomeSummaryCard({
  summary,
  generatedAt,
  loading,
  error,
  warning,
  onRefresh,
  audienceLabel = 'MUPİ · Günlük',
}: AiHomeSummaryCardProps) {
  const generatedLabel = formatGeneratedAt(generatedAt)
  const summaryDateLabel = formatSummaryDate(summary?.summary_date)
  const isV2 = looksLikeV2(summary)
  const splitItems = summary && isV2 ? splitV2Items(summary) : { today: [], upcoming: [] }

  return (
    <section className="mb-4 overflow-hidden rounded-xl border border-brand/15 bg-white shadow-card sm:mb-5">
      <div className="flex items-center gap-3 border-b border-canvas-border px-4 py-3 sm:px-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand shadow-sm">
          <img src="/mupi.png" alt="MUPİ" className="h-full w-full object-cover" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="text-base font-semibold text-ink">MUPİ günlük özeti</h2>
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold text-brand-dark">{audienceLabel}</span>
          </div>
          <p className="mt-0.5 text-xs text-ink-soft">
            {loading && !summary
              ? 'Günün öncelikleri hazırlanıyor…'
              : generatedLabel
                ? `${summaryDateLabel ? `${summaryDateLabel} · ` : ''}Son güncelleme: ${generatedLabel}`
                : 'Yetkili uygulama kayıtlarından otomatik hazırlanır'}
          </p>
        </div>
      </div>

      <div className="px-4 py-3 sm:px-5">
        {error ? (
          <div role="alert" className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            {onRefresh ? <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="shrink-0 self-start rounded-md px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60 sm:self-auto"
            >
              Tekrar dene
            </button> : null}
          </div>
        ) : loading && !summary ? (
          <div className="flex items-center gap-2 py-1 text-sm text-ink-soft">
            <span className="h-2 w-2 animate-pulse rounded-full bg-brand" aria-hidden="true" />
            Güncel görev, etkinlik ve takvim kayıtları değerlendiriliyor.
          </div>
        ) : summary ? (
          <>
            <p className="text-sm font-medium leading-5 text-ink">{summary.intro}</p>
            {warning ? <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{warning}</p> : null}

            {isV2 ? (
              <div className="mt-3 grid gap-4">
                <section aria-labelledby="mupi-today-heading">
                  <div className="flex items-center justify-between gap-2">
                    <h3 id="mupi-today-heading" className="text-xs font-bold uppercase tracking-[0.14em] text-brand-dark">Bugün</h3>
                    <span className="text-[11px] text-ink-soft">En fazla 3 konu</span>
                  </div>
                  {splitItems.today.length > 0
                    ? <SummaryList items={splitItems.today} />
                    : <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Bugün için acil bir aksiyon görünmüyor.</p>}
                </section>

                <section aria-labelledby="mupi-upcoming-heading" className="border-t border-canvas-border pt-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 id="mupi-upcoming-heading" className="text-xs font-bold uppercase tracking-[0.14em] text-ink-soft">Yakında</h3>
                    <span className="text-[11px] text-ink-soft">Hazırlığa değer konular</span>
                  </div>
                  {splitItems.upcoming.length > 0
                    ? <SummaryList items={splitItems.upcoming} />
                    : <p className="mt-2 text-sm text-ink-soft">Yakında hazırlık gerektiren ek bir konu görünmüyor.</p>}
                </section>
              </div>
            ) : summary.items.length > 0 ? (
              <SummaryList items={summary.items} />
            ) : (
              <p className="mt-1 text-sm text-ink-soft">Yakın tarihli veya acil bir işlem görünmüyor.</p>
            )}

            {summary.club_summary ? (
              <div className="mt-3 border-t border-canvas-border pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Kulüpte ayrıca</p>
                <p className="mt-1 text-sm font-medium leading-5 text-ink">{summary.club_summary.intro}</p>
                {summary.club_summary.items.length > 0 ? (
                  <ul className="mt-1.5 space-y-1.5">
                    {summary.club_summary.items.slice(0, 2).map((item) => (
                      <li key={`club-${item.source_type}-${item.source_id}`} className="flex items-start justify-between gap-3 text-sm text-ink-soft">
                        <span className="min-w-0 break-words">{item.recommendation}</span>
                        <Link to={item.route} className="shrink-0 font-semibold text-brand-dark hover:underline">Git ›</Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-ink-soft">Günlük özet henüz hazırlanmadı.</p>
        )}
      </div>
    </section>
  )
}
