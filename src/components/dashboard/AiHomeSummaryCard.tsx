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
}

export interface AiHomeSummary {
  intro: string
  items: AiHomeSummaryItem[]
}

interface AiHomeSummaryCardProps {
  summary: AiHomeSummary | null
  generatedAt: string | null
  loading: boolean
  error: string | null
  warning: string | null
  onRefresh: () => void
}

const reasonLabels: Record<string, string> = {
  overdue_task: 'Geciken görev',
  due_soon_task: 'Yaklaşan son tarih',
  high_priority_task: 'Yüksek öncelik',
  assigned_open_task: 'Atanmış açık görev',
  open_task: 'Açık görev',
  missing_event_field: 'Eksik etkinlik bilgisi',
  event_preparation_active: 'Hazırlık dönemi',
  event_final_days: 'Etkinliğe son günler',
  event_day: 'Etkinlik günü',
  event_report_due: 'Rapor zamanı',
  missing_awareness_field: 'Eksik farkındalık bilgisi',
  awareness_preparation_active: 'İçerik hazırlık dönemi',
  awareness_share_due_soon: 'Yaklaşan paylaşım',
  upcoming_calendar_entry: 'Yaklaşan takvim kaydı',
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <path d="M12 3l1.3 4.1L17 9l-3.7 1.9L12 15l-1.3-4.1L7 9l3.7-1.9z" />
      <path d="M18.5 14.5l.7 2.1 1.8.9-1.8.9-.7 2.1-.7-2.1-1.8-.9 1.8-.9z" />
      <path d="M5 3.5l.7 2.1 1.8.9-1.8.9L5 9.5l-.7-2.1-1.8-.9 1.8-.9z" />
    </svg>
  )
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

export default function AiHomeSummaryCard({
  summary,
  generatedAt,
  loading,
  error,
  warning,
  onRefresh,
}: AiHomeSummaryCardProps) {
  const generatedLabel = formatGeneratedAt(generatedAt)

  return (
    <section className="mb-4 overflow-hidden rounded-xl border border-brand/15 bg-white shadow-card sm:mb-5">
      <div className="flex items-center gap-3 border-b border-canvas-border px-4 py-3 sm:px-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-white shadow-sm">
          <SparkleIcon />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="text-base font-semibold text-ink">Günlük özet</h2>
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold text-brand-dark">AI · Süper Yönetici</span>
          </div>
          <p className="mt-0.5 text-xs text-ink-soft">
            {loading && !summary
              ? 'Günün öncelikleri hazırlanıyor…'
              : generatedLabel
                ? `Son güncelleme: ${generatedLabel} · Günde bir kez hazırlanır`
                : 'Yetkili uygulama kayıtlarından otomatik hazırlanır'}
          </p>
        </div>
      </div>

      <div className="px-4 py-3 sm:px-5">
        {error ? (
          <div role="alert" className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="shrink-0 self-start rounded-md px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60 sm:self-auto"
            >
              Tekrar dene
            </button>
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
            {summary.items.length > 0 ? (
              <ul className="mt-2 divide-y divide-canvas-border">
                {summary.items.slice(0, 3).map((item) => (
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
                      Kayda git <span className="ml-1" aria-hidden="true">›</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-ink-soft">Yakın tarihli veya acil bir işlem görünmüyor.</p>
            )}
          </>
        ) : (
          <p className="text-sm text-ink-soft">Günlük özet henüz hazırlanmadı.</p>
        )}
      </div>
    </section>
  )
}
