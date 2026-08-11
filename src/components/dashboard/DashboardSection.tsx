import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

type DashboardSectionTone = 'default' | 'danger' | 'success'

interface DashboardSectionProps { title: string; children: ReactNode; actionLabel?: string; actionTo?: string; headerAction?: ReactNode; countLabel?: string; tone?: DashboardSectionTone; className?: string }

const titleToneClasses: Record<DashboardSectionTone, string> = { default: 'text-ink', danger: 'text-danger', success: 'text-brand-dark' }
const countToneClasses: Record<DashboardSectionTone, string> = { default: 'bg-canvas-border/60 text-ink-soft', danger: 'bg-danger-soft text-danger', success: 'bg-brand-soft text-brand-dark' }

function ChevronIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg> }

export default function DashboardSection({ title, children, actionLabel, actionTo, headerAction, countLabel, tone = 'default', className = '' }: DashboardSectionProps) {
  return (
    <section className={['rounded-xl border border-canvas-border bg-canvas-surface p-4 shadow-card sm:p-5', className].filter(Boolean).join(' ')}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className={['break-words text-base font-semibold', titleToneClasses[tone]].join(' ')}>{title}</h2>
          {countLabel ? <span className={['inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium leading-none', countToneClasses[tone]].join(' ')}>{countLabel}</span> : null}
        </div>
        {headerAction ?? (actionLabel && actionTo ? <Link to={actionTo} className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-brand-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"><span>{actionLabel}</span><ChevronIcon /></Link> : null)}
      </div>
      {children}
    </section>
  )
}
