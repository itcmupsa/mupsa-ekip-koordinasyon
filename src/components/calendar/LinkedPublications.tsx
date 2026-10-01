import { Link } from 'react-router-dom'
import { formatOptionalTime, isSafeExternalUrl, PR_ENTRY_KINDS, PR_ENTRY_STATUSES } from '../../lib/prCalendar'
import { planCreationUrl, publicationLinks, type SharedLink } from '../../lib/publicationPlan'
import type { usePublicationPlan } from '../../hooks/usePublicationPlan'

export function SharedLinks({ title, links, sourceUrl }: { title: string; links: SharedLink[]; sourceUrl: string }) {
  return <div className="rounded-xl border border-canvas-border bg-canvas p-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-ink">{title}</h3><Link to={sourceUrl} className="inline-flex min-h-11 items-center text-xs font-medium text-brand-dark underline">Kaynak kayıtta aç</Link></div>
    <p className="text-xs text-ink-soft">Aynı bağlantılar kaynak kayıttan gösterilir; burada kopyası tutulmaz.</p>
    {links.length ? <ul className="mt-2 space-y-1">{links.map(l => isSafeExternalUrl(l.url) ? <li key={l.id}><a href={l.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 break-all text-sm text-brand-dark underline">{l.label}</a></li> : null)}</ul> : <p className="mt-2 text-sm text-ink-soft">Henüz ortak bağlantı eklenmedi.</p>}
  </div>
}

export default function LinkedPublications({ plan, sourceKind, sourceId, compact = false }: {
  plan: ReturnType<typeof usePublicationPlan>; sourceKind: 'event' | 'awareness'; sourceId: string; compact?: boolean
}) {
  const rows = plan.rows.filter(r => sourceKind === 'event' ? r.event_id === sourceId : r.awareness_post_id === sourceId)
  return <section className={`rounded-xl border border-canvas-border bg-canvas-surface ${compact ? 'p-3' : 'p-4 sm:p-6'} shadow-card`} aria-label="Bağlı yayınlar">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold text-ink">Yayınlar</h2>{plan.canManage ? <Link to={planCreationUrl(sourceKind, sourceId)} className="inline-flex min-h-11 items-center rounded-lg bg-brand-dark px-3 text-sm font-semibold text-white">Yayın planla</Link> : <Link to="/app/takvimler/pr" className="inline-flex min-h-11 items-center text-sm text-brand-dark underline">PR takvimini aç</Link>}</div>
    <p className="mt-1 text-xs text-ink-soft">PR takvimindeki aynı kayıtlar gösterilir. Tarih, durum ve yayın bağlantıları PR'de güncellenir.</p>
    <p className="mt-2 text-sm text-ink-soft">Yayın yönetimi: <span className="font-medium text-ink">{plan.managers.map(m => m.display_name).join(', ') || 'Henüz tanımlanmadı'}</span></p>
    {plan.error ? <p role="alert" className="mt-3 text-sm text-danger">Yayınlar yüklenemedi. PR takviminden kontrol edin.</p> : plan.loading ? <p className="mt-3 text-sm text-ink-soft">Yayınlar yükleniyor…</p> : rows.length === 0 ? <p className="mt-3 rounded-lg bg-canvas p-3 text-sm text-ink-soft">Bu {sourceKind === 'event' ? 'etkinlik' : 'farkındalık'} için henüz yayın planlanmadı.</p> : <ul className="mt-3 space-y-3">{rows.map(row => <li key={row.id} className="rounded-xl border border-canvas-border bg-canvas p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><Link to={`/app/takvimler/pr?entry=${encodeURIComponent(row.id)}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-dark underline">{row.title}</Link><span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs text-brand-dark">{PR_ENTRY_STATUSES.find(s => s.value === row.status)?.label ?? row.status}</span></div>
      <p className="text-sm text-ink-soft">{new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${row.scheduled_date}T00:00:00Z`))} · {formatOptionalTime(row.scheduled_time)} · {PR_ENTRY_KINDS.find(k => k.value === row.entry_kind)?.label ?? row.entry_kind}</p>
      <p className="mt-1 text-xs text-ink-soft">{row.channels?.join(' · ') || 'Kanal seçilmedi'}</p>
      {publicationLinks(row).length ? <div className="mt-2 border-t border-canvas-border pt-2"><p className="text-xs font-semibold text-ink-soft">Yayına ait bağlantılar</p>{publicationLinks(row).map(l => isSafeExternalUrl(l.url) ? <a key={l.id} href={l.url} target="_blank" rel="noreferrer" className="flex min-h-11 items-center break-all text-sm text-brand-dark underline">{l.label}</a> : null)}</div> : null}
    </li>)}</ul>}
  </section>
}
