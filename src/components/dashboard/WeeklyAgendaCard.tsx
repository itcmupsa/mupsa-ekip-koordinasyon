import type { ReactElement } from 'react'
import { Link } from 'react-router-dom'
import DashboardEmptyState from './DashboardEmptyState'

export type AgendaItemKind = 'event' | 'awareness' | 'task' | 'manual'
export interface WeeklyAgendaItem { id: string; dateLabel: string; dayLabel?: string; title: string; timeLabel?: string; kind: AgendaItemKind; to?: string }
interface WeeklyAgendaCardProps { items: WeeklyAgendaItem[]; calendarTo?: string; className?: string }

const kindClasses: Record<AgendaItemKind, { bg: string; text: string }> = {
  event: { bg: 'bg-brand-soft', text: 'text-brand-dark' }, awareness: { bg: 'bg-accent-soft', text: 'text-amber-800' }, task: { bg: 'bg-sky-100', text: 'text-sky-700' }, manual: { bg: 'bg-canvas-border/60', text: 'text-ink-soft' },
}
const iconProps = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className: 'h-4 w-4', 'aria-hidden': true }
function EventIcon() { return <svg {...iconProps}><rect x="3.5" y="4.5" width="17" height="16" rx="2" /><path d="M3.5 9.5h17M8 3v3M16 3v3" /></svg> }
function AwarenessIcon() { return <svg {...iconProps}><path d="M4 10v3a1 1 0 0 0 1 1h2l4.5 3.5v-11L7 10H5a1 1 0 0 0-1 1zM16.5 9a4 4 0 0 1 0 6" /></svg> }
function TaskIcon() { return <svg {...iconProps}><rect x="5" y="3.5" width="14" height="17" rx="2" /><path d="m8.5 11.5 2 2L15 9" /></svg> }
function ManualIcon() { return <svg {...iconProps}><circle cx="12" cy="12" r="1.4" /><circle cx="12" cy="6" r="1.4" /><circle cx="12" cy="18" r="1.4" /></svg> }
const kindIcons: Record<AgendaItemKind, () => ReactElement> = { event: EventIcon, awareness: AwarenessIcon, task: TaskIcon, manual: ManualIcon }
function ChevronIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-ink-soft" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg> }

export default function WeeklyAgendaCard({ items, calendarTo = '/app/takvim', className = '' }: WeeklyAgendaCardProps) {
  return (
    <div className={['rounded-xl border border-canvas-border bg-canvas-surface p-4 shadow-card sm:p-5', className].filter(Boolean).join(' ')}>
      <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-base font-semibold text-ink">Bu hafta</h2><Link to={calendarTo} className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-brand-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"><span>Tam takvimi aç</span><ChevronIcon /></Link></div>
      {items.length === 0 ? <DashboardEmptyState message="Bu hafta planlanmış bir kayıt bulunmuyor." icon="calendar" tone="neutral" compact /> : (
        <ul className="flex flex-col gap-1">{items.map((item) => {
          const Icon = kindIcons[item.kind]
          const colors = kindClasses[item.kind]
          const content = <><span className={['flex h-9 w-9 shrink-0 items-center justify-center rounded-full', colors.bg, colors.text].join(' ')}><Icon /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline gap-x-2 text-xs text-ink-soft"><span>{item.dateLabel}</span>{item.dayLabel ? <span>{item.dayLabel}</span> : null}</div><p className="break-words text-sm font-medium text-ink">{item.title}</p>{item.timeLabel ? <p className="text-xs text-ink-soft">{item.timeLabel}</p> : null}</div></>
          return <li key={item.id}>{item.to ? <Link to={item.to} className="flex min-h-[48px] items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">{content}<ChevronIcon /></Link> : <div className="flex min-h-[48px] items-center gap-3 px-2 py-2">{content}</div>}</li>
        })}</ul>
      )}
    </div>
  )
}
