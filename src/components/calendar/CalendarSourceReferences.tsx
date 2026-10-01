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
    <div className="mb-3 rounded-xl border border-orange-200 bg-orange-50 p-3 shadow-sm">
      <h3 className="text-sm font-semibold text-orange-900">{title}</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {ranges.map(r => {
          const className = "inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-orange-100 px-2.5 py-1.5 text-xs font-medium text-orange-900 transition-colors hover:bg-orange-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          const content = <>{r.title} ({dayLabel(r.start)} - {dayLabel(r.end)})</>
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
    <div className="flex flex-wrap gap-4 px-1 py-2 sm:px-0">
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink hover:text-ink-dark">
        <input type="checkbox" checked={showEvents} onChange={(e) => setShowEvents(e.target.checked)} className="h-4 w-4 rounded border-canvas-border text-brand focus:ring-brand" />
        Etkinlikler ({eventCount})
      </label>
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink hover:text-ink-dark">
        <input type="checkbox" checked={showAwareness} onChange={(e) => setShowAwareness(e.target.checked)} className="h-4 w-4 rounded border-canvas-border text-brand focus:ring-brand" />
        Farkındalıklar ({awarenessCount})
      </label>
    </div>
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
