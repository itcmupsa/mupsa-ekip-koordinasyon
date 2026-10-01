import { useState, useEffect, useId } from 'react'
import { Link } from 'react-router-dom'
import { formatOptionalTime, isSafeExternalUrl, PR_ENTRY_STATUSES } from '../../lib/prCalendar'
import { planCreationUrl, publicationLinks, type SharedLink } from '../../lib/publicationPlan'
import type { usePublicationPlan } from '../../hooks/usePublicationPlan'

export function SharedLinks({ title, links, sourceUrl }: { title: string; links: SharedLink[]; sourceUrl: string }) {
  return <div className="rounded-xl border border-canvas-border bg-canvas p-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-ink">{title}</h3><Link to={sourceUrl} className="inline-flex min-h-[44px] items-center text-xs font-medium text-ink hover:underline focus:outline-none focus:ring-2 focus:ring-brand rounded-sm">Kaynak kayıtta aç</Link></div>
    <p className="text-xs text-ink-soft">Bağlantıları bağlı etkinlik veya farkındalık kaydından düzenleyebilirsiniz.</p>
    {links.length ? <ul className="mt-2 space-y-1">{links.map(l => isSafeExternalUrl(l.url) ? <li key={l.id}><a href={l.url} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center break-all text-sm text-ink hover:underline focus:outline-none focus:ring-2 focus:ring-brand rounded-sm">{l.label}</a></li> : null)}</ul> : <p className="mt-2 text-sm text-ink-soft">Henüz ortak bağlantı eklenmedi.</p>}
  </div>
}

export default function LinkedPublications({
  plan,
  sourceKind,
  sourceId,
  defaultExpanded = false,
  embedded = false,
  onOpenFull
}: {
  plan: ReturnType<typeof usePublicationPlan>
  sourceKind: 'event' | 'awareness'
  sourceId: string
  defaultExpanded?: boolean
  embedded?: boolean
  onOpenFull?: () => void
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const contentId = useId()

  useEffect(() => {
    if (defaultExpanded) {
      setIsExpanded(true)
    }
  }, [defaultExpanded])
  const rows = plan.rows.filter(r => sourceKind === 'event' ? r.event_id === sourceId : r.awareness_post_id === sourceId)

  const shootingCount = rows.filter(r => r.entry_kind === 'shooting').length
  const publicationCount = rows.filter(r => r.entry_kind === 'publication').length
  const otherCount = rows.filter(r => r.entry_kind === 'other').length
  const aggregateCounts = [shootingCount ? `${shootingCount} çekim` : '', publicationCount ? `${publicationCount} paylaşım` : '', otherCount ? `${otherCount} diğer` : ''].filter(Boolean).join(' · ')

  const activeCount = rows.filter(r => !['completed', 'cancelled'].includes(r.status)).length
  const semanticState = rows.length > 0 ? (rows.every(r => r.status === 'cancelled') ? 'İptal' : activeCount === 0 ? 'Tamamlandı' : 'Devam ediyor') : null
  const statusTone = (status: string) => status === 'completed' || status === 'Tamamlandı' ? 'bg-success-soft text-success' : status === 'ready' ? 'bg-sky-50 text-sky-800' : status === 'cancelled' || status === 'İptal' ? 'bg-stone-100 text-stone-600' : 'bg-canvas text-ink-soft'

  const managers = plan.managers.map(m => m.display_name).join(', ')

  if (plan.error) {
    return <div className="rounded-xl border border-canvas-border bg-canvas-surface p-4 text-sm text-red-600">Yayınlar yüklenemedi. PR takviminden kontrol edin.</div>
  }

  if (plan.loading) {
    return <div className="rounded-xl border border-canvas-border bg-canvas-surface p-4 text-sm text-ink-soft">Yayınlar yükleniyor…</div>
  }

  if (rows.length === 0) {
    return (
      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-canvas-border bg-canvas-surface p-4 ${embedded ? 'border-none shadow-none' : 'shadow-card'}`}>
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-ink-soft" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>
          <span className="text-sm font-semibold text-ink">PR planı:</span>
          <span className="text-sm text-ink-soft">Henüz yayın planlanmadı.</span>
          {!embedded && managers && <span className="hidden sm:inline-block ml-2 text-[11px] text-ink-soft">Yönetim: {managers}</span>}
        </div>
        <div className="flex items-center gap-2">
          {plan.canManage && <Link to={planCreationUrl(sourceKind, sourceId)} className="inline-flex min-h-[44px] items-center rounded-md bg-canvas px-3 text-xs font-semibold text-brand-dark hover:bg-canvas-border focus:outline-none focus:ring-2 focus:ring-brand">Yayın planla</Link>}
        </div>
      </div>
    )
  }

  const renderGroup = (kind: string, title: string) => {
    const groupRows = rows.filter(r => r.entry_kind === kind)
    if (groupRows.length === 0) return null
    return (
      <div key={kind} className="mt-4 first:mt-0">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-soft">{title}</h3>
        <div className="mt-2 divide-y divide-canvas-border rounded-md border border-canvas-border bg-canvas">
          <div className="hidden gap-4 border-b border-canvas-border px-3 py-2 text-[11px] font-medium text-ink-soft md:grid md:grid-cols-[minmax(0,1fr)_9rem_9rem_7rem]"><span>Başlık</span><span>Tarih / saat</span><span>Kanal</span><span className="text-right">Durum</span></div>
          {groupRows.map(row => {
            const links = publicationLinks(row)
            return (
              <div key={row.id} className="flex flex-col px-3 py-2 text-sm">
                <div className="flex flex-col md:grid md:grid-cols-[minmax(0,1fr)_9rem_9rem_7rem] md:items-center md:gap-4">
                  <div className="flex-1 min-w-0">
                    <Link to={`/app/takvimler/pr?entry=${encodeURIComponent(row.id)}`} className="inline-flex min-h-[44px] items-center font-semibold text-ink hover:text-ink-soft hover:underline focus:outline-none focus:ring-2 focus:ring-brand rounded-sm">{row.title}</Link>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft md:contents">
                    <span>
                      {new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${row.scheduled_date}T00:00:00Z`))}
                      {row.scheduled_time ? ` ${formatOptionalTime(row.scheduled_time)}` : ''}
                    </span>
                    <span className="min-w-0 break-words">{row.channels?.join(', ') || '-'}</span>
                    <span className="flex justify-start md:justify-end">
                      <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone(row.status)}`}>
                        {PR_ENTRY_STATUSES.find(s => s.value === row.status)?.label ?? row.status}
                      </span>
                    </span>
                  </div>
                </div>
                {links.length > 0 && (
                  <div className="w-full">
                    <details className="text-xs">
                      <summary className="cursor-pointer font-medium text-ink hover:underline inline-flex items-center min-h-[44px] focus:outline-none focus:ring-2 focus:ring-brand rounded-sm">
                        Bağlantılar ({links.length})
                      </summary>
                      <div className="flex flex-col gap-1 pl-2 pb-2">
                        {links.map(l => isSafeExternalUrl(l.url) ? <a key={l.id} href={l.url} target="_blank" rel="noreferrer" className="text-ink hover:underline flex min-h-[44px] items-center focus:outline-none focus:ring-2 focus:ring-brand rounded-sm">{l.label}</a> : null)}
                      </div>
                    </details>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-xl border border-canvas-border bg-canvas-surface ${embedded ? 'border-none shadow-none' : 'shadow-card'}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <svg className="h-5 w-5 text-ink-soft" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>
            <h2 className="text-sm font-semibold text-ink">PR planı</h2>
            {semanticState && <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone(semanticState)}`}>{semanticState}</span>}
            <span className="rounded-md bg-canvas px-2 py-1 text-[11px] font-medium text-ink-soft border border-canvas-border">{aggregateCounts}</span>
          </div>
          {!embedded && managers && <span className="text-[11px] text-ink-soft">Yönetim: {managers}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {plan.canManage && isExpanded && <Link to={planCreationUrl(sourceKind, sourceId)} className="inline-flex min-h-[44px] items-center rounded-md bg-canvas px-3 text-xs font-semibold text-brand-dark hover:bg-canvas-border focus:outline-none focus:ring-2 focus:ring-brand">Yayın planla</Link>}
          <Link to="/app/takvimler/pr" className="inline-flex min-h-[44px] items-center px-2 text-xs text-ink-soft hover:text-ink hover:underline focus:outline-none focus:ring-2 focus:ring-brand rounded-sm">PR takviminde aç</Link>
          {onOpenFull ? (
            <button type="button" onClick={onOpenFull} className="inline-flex min-h-[44px] items-center rounded-md bg-canvas px-3 text-xs font-semibold text-ink hover:bg-canvas-border focus:outline-none focus:ring-2 focus:ring-brand border border-canvas-border">
              Tümünü aç
            </button>
          ) : !embedded ? (
            <button type="button" onClick={() => setIsExpanded(!isExpanded)} aria-expanded={isExpanded} aria-controls={contentId} className="inline-flex min-h-[44px] items-center rounded-md bg-canvas px-3 text-xs font-semibold text-ink hover:bg-canvas-border focus:outline-none focus:ring-2 focus:ring-brand border border-canvas-border">
              {isExpanded ? 'Planı gizle' : 'Planı aç'}
            </button>
          ) : null}
        </div>
      </div>

      {isExpanded && (
        <div id={contentId} className="border-t border-canvas-border p-4">
          {renderGroup('shooting', 'Çekimler')}
          {renderGroup('publication', 'Paylaşımlar')}
          {renderGroup('other', 'Diğer kayıtlar')}
        </div>
      )}
    </div>
  )
}
