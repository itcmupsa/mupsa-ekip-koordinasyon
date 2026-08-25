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
    <section className="mb-5 overflow-hidden rounded-2xl border border-brand/20 bg-gradient-to-br from-brand-soft via-white to-accent-soft/50 shadow-card sm:mb-6">
      <div className="flex flex-col gap-3 border-b border-brand/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-sm">
            <SparkleIcon />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-ink sm:text-lg">AI Günlük Özeti</h2>
              <span className="rounded-full border border-brand/20 bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-brand-dark">Süper Yönetici pilotu</span>
            </div>
            <p className="mt-0.5 text-xs text-ink-soft">
              Yalnızca yetkili ve doğrulanmış uygulama kayıtlarından hazırlanır.
              {generatedLabel ? ` Son üretim: ${generatedLabel}.` : ''}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="min-h-[40px] shrink-0 rounded-lg border border-brand/25 bg-white px-3 py-2 text-sm font-semibold text-brand-dark transition-colors hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Hazırlanıyor…' : summary ? 'Özeti yenile' : 'Özeti hazırla'}
        </button>
      </div>

      <div className="px-4 py-4 sm:px-5">
        {error ? (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">{error}</div>
        ) : loading && !summary ? (
          <p className="text-sm text-ink-soft">Güncel görev ve süreçler güvenli şekilde değerlendiriliyor…</p>
        ) : summary ? (
          <>
            <p className="text-sm font-medium text-ink">{summary.intro}</p>
            {warning ? <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{warning}</p> : null}
            {summary.items.length > 0 ? (
              <ul className="mt-3 grid gap-2 lg:grid-cols-2">
                {summary.items.map((item) => (
                  <li key={`${item.source_type}-${item.source_id}`} className="flex min-w-0 flex-col rounded-xl border border-white bg-white/85 p-3 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand-dark">
                        {reasonLabels[item.reason_code] ?? 'AI değerlendirmesi'}
                      </span>
                      <span className="text-[11px] font-medium text-ink-soft">AI önerisi</span>
                    </div>
                    <p className="mt-2 break-words text-sm font-semibold text-ink">{item.title}</p>
                    <p className="mt-1 break-words text-sm leading-5 text-ink-soft">{item.recommendation}</p>
                    <Link to={item.route} className="mt-3 inline-flex min-h-[36px] items-center self-start rounded-lg px-2.5 py-2 text-sm font-semibold text-brand-dark hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">
                      İlgili kayda git
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-ink-soft">Bugün için öncelikli bir öneri bulunmuyor.</p>
            )}
          </>
        ) : (
          <p className="text-sm text-ink-soft">İlk güvenli özeti oluşturmak için “Özeti hazırla” düğmesini kullan.</p>
        )}
      </div>
    </section>
  )
}
