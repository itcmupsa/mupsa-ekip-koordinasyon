import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

export interface RangeReference {
  id: string
  title: string
  start: string
  end: string
  onClick?: () => void
  linkTo?: string
}

export function AwarenessRangeStrip({ title, ranges }: { title: string, ranges: RangeReference[] }) {
  if (ranges.length === 0) return null
  return (
    <div className="mb-3 flex flex-col gap-2.5 rounded-xl border border-orange-200/70 bg-orange-50/60 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-4">
      <h3 className="flex shrink-0 items-center gap-2 text-xs font-medium text-orange-800"><span className="h-1.5 w-1.5 rounded-full bg-orange-500" aria-hidden="true" />{title}</h3>
      <div className="flex min-w-0 flex-wrap gap-2">
        {ranges.map(r => {
          const className = 'group inline-flex min-h-11 max-w-full flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg border border-orange-200/70 bg-white/80 px-3 py-2 text-left text-xs text-orange-950 transition-colors hover:border-orange-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500'
          const content = <><span className="break-words font-medium">{r.title}</span><span className="whitespace-nowrap text-[11px] text-orange-700">{dayLabel(r.start)} – {dayLabel(r.end)}</span><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="ml-auto h-3.5 w-3.5 shrink-0 text-orange-400 transition-colors group-hover:text-orange-700"><path d="m9 5 7 7-7 7" /></svg></>
          return r.linkTo ? (
            <Link key={r.id} to={r.linkTo} className={className}>
              {content}
            </Link>
          ) : (
            <button key={r.id} type="button" onClick={r.onClick} className={className}>
              {content}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function EventReferenceChip({ title, onClick }: { title: string, onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-1 block min-h-11 w-full truncate rounded border border-green-200 bg-green-50 px-1.5 py-1 text-left text-xs font-medium text-green-900 transition-colors hover:bg-green-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
    >
      <span className="flex items-center gap-1">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 shrink-0"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <span className="truncate" title={title}>Etkinlik · {title}</span>
      </span>
    </button>
  )
}

export function AwarenessReferenceChip({ title, onClick }: { title: string, onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-1 block min-h-11 w-full truncate rounded border border-orange-200 bg-orange-50 px-1.5 py-1 text-left text-xs font-medium text-orange-900 transition-colors hover:bg-orange-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
    >
      <span className="flex items-center gap-1">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 shrink-0"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
        <span className="truncate" title={title}>Farkındalık · {title}</span>
      </span>
    </button>
  )
}

export function ReferenceToggles({
  showEvents, setShowEvents,
  showAwareness, setShowAwareness,
  eventCount, awarenessCount
}: {
  showEvents: boolean
  setShowEvents: (v: boolean) => void
  showAwareness: boolean
  setShowAwareness: (v: boolean) => void
  eventCount: number
  awarenessCount: number
}) {
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-3" role="group" aria-label="Takvimde gösterilecek kaynaklar">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Takvimde göster</span>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <SourceToggle label="Etkinlikler" count={eventCount} active={showEvents} onToggle={() => setShowEvents(!showEvents)} kind="event" />
        <SourceToggle label="Farkındalıklar" count={awarenessCount} active={showAwareness} onToggle={() => setShowAwareness(!showAwareness)} kind="awareness" />
      </div>
    </div>
  )
}

function SourceToggle({ label, count, active, onToggle, kind }: {
  label: string; count: number; active: boolean; onToggle: () => void; kind: 'event' | 'awareness'
}) {
  return (
    <button type="button" aria-pressed={active} onClick={onToggle}
      className={`inline-flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-xl border px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 sm:gap-2 sm:px-3 sm:text-sm ${active ? 'border-brand/30 bg-brand-soft/50 text-ink shadow-sm' : 'border-canvas-border bg-white text-ink-soft hover:border-brand/25 hover:bg-canvas'}`}>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={`h-4 w-4 shrink-0 ${active ? (kind === 'event' ? 'text-emerald-700' : 'text-orange-700') : 'text-ink-soft'}`}>
        {kind === 'event' ? <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M16 3v4M8 3v4M3 11h18" /></> : <><circle cx="12" cy="12" r="9" /><path d="M12 8v4m0 4h.01" /></>}
      </svg>
      <span>{label}</span>
      <span title="Aktif dönemdeki kaynak sayısı" className={`flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md px-1 text-[10px] tabular-nums ${active ? 'bg-white/80 text-brand-dark' : 'bg-canvas text-ink-soft'}`}>{count}</span>
      <span aria-hidden="true" className={`ml-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${active ? 'border-brand bg-brand text-white' : 'border-canvas-border bg-white'}`}>
        {active ? <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-2.5 w-2.5"><path d="m4 8 2.5 2.5L12 5" /></svg> : null}
      </span>
    </button>
  )
}

function dayLabel(value: string) {
  if (!value) return ''
  const parsed = new Date(value + 'T12:00:00Z')
  if (Number.isNaN(parsed.getTime())) return value
  const sameYear = parsed.getUTCFullYear() === new Date().getUTCFullYear()
  return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', year: sameYear ? undefined : 'numeric', timeZone: 'UTC' }).format(parsed)
}


export function SelectedSourcePanel({
  source,
  kind,
  canManage,
  onCreatePlan
}: {
  source: { id: string; title: string; start: string; end?: string; typeLabel: string; viewUrl: string; isManual?: boolean }
  kind: 'event' | 'awareness'
  canManage: boolean
  onCreatePlan: () => void
}) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => { titleRef.current?.focus() }, [source.id, kind])
  return (
    <section aria-labelledby="selected-source-title" className="mt-3 rounded-xl border border-canvas-border bg-white p-4 shadow-card sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span className={`h-3 w-3 rounded-full ${kind === 'event' ? 'bg-green-500' : 'bg-orange-500'}`} aria-hidden="true" />
            Kaynak Referansı ({source.typeLabel})
          </p>
          <h3 id="selected-source-title" ref={titleRef} tabIndex={-1} className="mt-2 break-words text-xl font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">{source.title}</h3>
          <p className="mt-1 text-sm text-ink-soft">
            {dayLabel(source.start)}
            {source.end && source.end !== source.start ? ` - ${dayLabel(source.end)}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={source.viewUrl}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-canvas-border bg-white px-4 text-sm font-medium text-ink shadow-sm transition-colors hover:border-brand/40 hover:text-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {source.isManual ? 'Takvim kaydını görüntüle' : (kind === 'event' ? 'Etkinliği görüntüle' : 'Farkındalığı görüntüle')}
          </Link>
          {canManage && !source.isManual ? (
            <button
              type="button"
              onClick={onCreatePlan}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              Bu kayıt için yayın planla
            </button>
          ) : null}
        </div>
      </div>
    </section>
  )
}
