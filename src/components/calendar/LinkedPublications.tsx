import { Link } from 'react-router-dom'
import { formatOptionalTime, isSafeExternalUrl, PR_ENTRY_STATUSES } from '../../lib/prCalendar'
import { planCreationUrl, publicationLinks, type SharedLink } from '../../lib/publicationPlan'
import type { usePublicationPlan } from '../../hooks/usePublicationPlan'

export function SharedLinks({ title, links, sourceUrl }: { title: string; links: SharedLink[]; sourceUrl: string }) {
  return <div className="rounded-xl border border-canvas-border bg-canvas p-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-ink">{title}</h3><Link to={sourceUrl} className="inline-flex min-h-11 items-center text-xs font-medium text-brand-dark underline">Kaynak kayıtta aç</Link></div>
    <p className="text-xs text-ink-soft">Bağlantıları bağlı etkinlik veya farkındalık kaydından düzenleyebilirsiniz.</p>
    {links.length ? <ul className="mt-2 space-y-1">{links.map(l => isSafeExternalUrl(l.url) ? <li key={l.id}><a href={l.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 break-all text-sm text-brand-dark underline">{l.label}</a></li> : null)}</ul> : <p className="mt-2 text-sm text-ink-soft">Henüz ortak bağlantı eklenmedi.</p>}
  </div>
}

export default function LinkedPublications({ plan, sourceKind, sourceId, compact = false, mode = 'full', showManagement = true, onOpenFull }: {
  plan: ReturnType<typeof usePublicationPlan>; sourceKind: 'event' | 'awareness'; sourceId: string; compact?: boolean; mode?: 'summary' | 'full'; showManagement?: boolean; onOpenFull?: () => void
}) {
  const isCompact = mode === 'summary' || compact
  const rows = plan.rows.filter(r => sourceKind === 'event' ? r.event_id === sourceId : r.awareness_post_id === sourceId)

  const renderCompactList = () => (
    <ul className="mt-3 divide-y divide-canvas-border border-t border-canvas-border">
      {rows.slice(0, 3).map(row => (
        <li key={row.id} className="py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link to={`/app/takvimler/pr?entry=${encodeURIComponent(row.id)}`} className="inline-flex min-h-11 min-w-0 items-center break-words text-sm font-semibold text-ink hover:text-brand-dark hover:underline">{row.title}</Link>
            <span className="shrink-0 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-medium text-brand-dark">{PR_ENTRY_STATUSES.find(s => s.value === row.status)?.label ?? row.status}</span>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 truncate text-[11px] text-ink-soft">
            <span>{new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${row.scheduled_date}T00:00:00Z`))}{row.scheduled_time ? ` ${formatOptionalTime(row.scheduled_time)}` : ''}</span>
            {row.channels?.length ? <span>· {row.channels.join(', ')}</span> : null}
          </p>
        </li>
      ))}
      {rows.length > 0 && onOpenFull ? (
        <li>
          <button type="button" onClick={onOpenFull} className="mt-2 flex min-h-11 w-full items-center justify-center rounded-lg bg-canvas text-xs font-semibold text-brand-dark hover:bg-canvas-border focus:outline-none focus:ring-2 focus:ring-brand">
            Tümünü aç · {rows.length} kayıt
          </button>
        </li>
      ) : rows.length > 3 && !onOpenFull ? (
        <li><Link to="/app/takvimler/pr" className="mt-2 flex min-h-11 w-full items-center justify-center rounded-lg bg-canvas text-xs font-semibold text-brand-dark hover:bg-canvas-border focus:outline-none focus:ring-2 focus:ring-brand">+{rows.length - 3} diğer kaydı takvimde gör</Link></li>
      ) : null}
    </ul>
  )

  const renderFullGroup = (kind: string, title: string) => {
    const groupRows = rows.filter(r => r.entry_kind === kind)
    if (groupRows.length === 0) return null
    return (
      <div key={kind} className="mt-4">
        <h3 className="text-sm font-semibold text-ink">{title} <span className="ml-2 rounded-full bg-canvas px-2 py-0.5 text-xs text-ink-soft">{groupRows.length}</span></h3>
        <ul className="mt-2 divide-y divide-canvas-border rounded-lg border border-canvas-border">
          {groupRows.map(row => (
            <li key={row.id} className="px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2"><Link to={`/app/takvimler/pr?entry=${encodeURIComponent(row.id)}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-dark underline">{row.title}</Link><span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs text-brand-dark">{PR_ENTRY_STATUSES.find(s => s.value === row.status)?.label ?? row.status}</span></div>
              <p className="flex flex-wrap gap-x-2 text-xs text-ink-soft"><span>{new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${row.scheduled_date}T00:00:00Z`))} · {formatOptionalTime(row.scheduled_time)}</span><span>{row.channels?.join(' · ') || 'Kanal seçilmedi'}</span></p>
              {publicationLinks(row).length ? <details className="mt-1"><summary className="min-h-11 cursor-pointer py-3 text-xs font-medium text-brand-dark">Bu {kind === 'shooting' ? 'çekimin' : 'kaydın'} bağlantıları ({publicationLinks(row).length})</summary>{publicationLinks(row).map(l => isSafeExternalUrl(l.url) ? <a key={l.id} href={l.url} target="_blank" rel="noreferrer" className="flex min-h-11 items-center break-all text-sm text-brand-dark underline">{l.label}</a> : null)}</details> : null}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const renderFullList = () => (
    <div className="mt-4">
      {renderFullGroup('shooting', 'Çekimler')}
      {renderFullGroup('publication', 'Paylaşımlar')}
      {renderFullGroup('other', 'Diğer kayıtlar')}
    </div>
  )

  return <section className={`rounded-xl border border-canvas-border bg-canvas-surface ${isCompact ? 'p-4 sm:p-5' : 'p-4 sm:p-6'} shadow-card`} aria-label="Bağlı yayınlar">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <h2 className="text-base font-semibold text-ink">Yayınlar</h2>
        {isCompact && rows.length > 0 && <span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold text-ink-soft">{rows.length} kayıt</span>}
      </div>
      {plan.canManage ? <Link to={planCreationUrl(sourceKind, sourceId)} className="inline-flex min-h-11 items-center rounded-lg bg-brand-dark px-3 text-sm font-semibold text-white">Yayın planla</Link> : <Link to="/app/takvimler/pr" className="inline-flex min-h-11 items-center text-sm text-brand-dark underline">PR takvimini aç</Link>}
    </div>

    {!isCompact && (
      <>
        <p className="mt-1 text-xs text-ink-soft">Tarih, durum ve bağlantılar için kaydı PR'de açın.</p>
        {showManagement && <p className="mt-2 text-sm text-ink-soft">Yayın yönetimi: <span className="font-medium text-ink">{plan.managers.map(m => m.display_name).join(', ') || 'Henüz tanımlanmadı'}</span></p>}
      </>
    )}

    {plan.error ? (
      <p role="alert" className="mt-3 text-sm text-danger">Yayınlar yüklenemedi. PR takviminden kontrol edin.</p>
    ) : plan.loading ? (
      <p className="mt-3 text-sm text-ink-soft">Yayınlar yükleniyor…</p>
    ) : rows.length === 0 ? (
      <p className="mt-3 rounded-lg bg-canvas p-3 text-sm text-ink-soft">Bu {sourceKind === 'event' ? 'etkinlik' : 'farkındalık'} için henüz yayın planlanmadı.</p>
    ) : isCompact ? (
      renderCompactList()
    ) : (
      renderFullList()
    )}
  </section>
}
