import type { ReactElement } from 'react'

type MetricIcon = 'members' | 'tasks' | 'unassigned' | 'event' | 'awareness' | 'overdue'
type MetricTone = 'brand' | 'accent' | 'danger' | 'neutral'

interface DashboardMetricCardProps {
  label: string
  value: string | number
  icon: MetricIcon
  tone?: MetricTone
  className?: string
}

const toneClasses: Record<MetricTone, { bg: string; text: string }> = {
  brand: { bg: 'bg-brand-soft', text: 'text-brand-dark' },
  accent: { bg: 'bg-accent-soft', text: 'text-amber-800' },
  danger: { bg: 'bg-danger-soft', text: 'text-danger' },
  neutral: { bg: 'bg-canvas-border/60', text: 'text-ink-soft' },
}

const iconProps = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className: 'h-5 w-5', 'aria-hidden': true }

function MembersIcon() { return <svg {...iconProps}><circle cx="9" cy="8" r="3" /><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" /><circle cx="17" cy="7.5" r="2.25" /><path d="M15.5 12.3a4.3 4.3 0 0 1 5 4.2" /></svg> }
function TasksIcon() { return <svg {...iconProps}><rect x="5" y="3.5" width="14" height="17" rx="2" /><path d="M9 3.5V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v.5" /><path d="m8.5 11.5 2 2L15 9" /></svg> }
function UnassignedIcon() { return <svg {...iconProps}><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0M9 20.5l3-3 3 3" strokeDasharray="2 2" /></svg> }
function EventIcon() { return <svg {...iconProps}><rect x="3.5" y="4.5" width="17" height="16" rx="2" /><path d="M3.5 9.5h17M8 3v3M16 3v3" /><circle cx="9" cy="14" r="1" /><circle cx="12.5" cy="14" r="1" /><circle cx="16" cy="14" r="1" /></svg> }
function AwarenessIcon() { return <svg {...iconProps}><path d="M4 10v3a1 1 0 0 0 1 1h2l4.5 3.5v-11L7 10H5a1 1 0 0 0-1 1zM16.5 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11" /></svg> }
function OverdueIcon() { return <svg {...iconProps}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v5l3 2" /></svg> }

const icons: Record<MetricIcon, () => ReactElement> = { members: MembersIcon, tasks: TasksIcon, unassigned: UnassignedIcon, event: EventIcon, awareness: AwarenessIcon, overdue: OverdueIcon }

export default function DashboardMetricCard({ label, value, icon, tone = 'neutral', className = '' }: DashboardMetricCardProps) {
  const Icon = icons[icon]
  const colors = toneClasses[tone]
  return (
    <div className={['flex min-h-[88px] items-center gap-2.5 rounded-xl border border-canvas-border bg-canvas-surface p-3 shadow-card sm:min-h-24 sm:gap-3 sm:p-4', className].filter(Boolean).join(' ')}>
      <span className={['flex h-10 w-10 shrink-0 items-center justify-center rounded-full sm:h-11 sm:w-11', colors.bg, colors.text].join(' ')}><Icon /></span>
      <div className="min-w-0">
        <p className="break-words text-xs leading-snug text-ink-soft sm:text-sm">{label}</p>
        <p className="mt-0.5 text-xl font-semibold leading-tight text-ink">{value}</p>
      </div>
    </div>
  )
}
