import { Link } from 'react-router-dom'
import ResponsibilityLabel from '../ResponsibilityLabel'
import TaskStatusBadge, { type TaskStatusTone } from '../TaskStatusBadge'

interface DashboardTaskRowProps { title: string; to: string; context?: string; deadlineLabel?: string; statusLabel?: string; statusTone?: TaskStatusTone; responsibilityLabel?: string; className?: string }

function CalendarIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="16" rx="2" /><path d="M3.5 9.5h17M8 3v3M16 3v3" /></svg> }
function ChevronIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-ink-soft" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg> }

export default function DashboardTaskRow({ title, to, context, deadlineLabel, statusLabel, statusTone, responsibilityLabel, className = '' }: DashboardTaskRowProps) {
  return (
    <Link to={to} className={['flex min-h-[48px] items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2', className].filter(Boolean).join(' ')}>
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-medium text-ink">{title}</p>
        {context ? <p className="mt-0.5 break-words text-xs text-ink-soft">{context}</p> : null}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          {deadlineLabel ? <span className="inline-flex items-center gap-1 text-xs text-ink-soft"><CalendarIcon /><span>{deadlineLabel}</span></span> : null}
          {responsibilityLabel ? <ResponsibilityLabel label={responsibilityLabel} /> : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">{statusLabel ? <TaskStatusBadge label={statusLabel} tone={statusTone} /> : null}<ChevronIcon /></div>
    </Link>
  )
}
