import type { ReactElement } from 'react'

type EmptyStateIcon = 'success' | 'calendar' | 'notifications' | 'tasks' | 'activity'
type EmptyStateTone = 'neutral' | 'success' | 'danger'

interface DashboardEmptyStateProps { message: string; description?: string; icon: EmptyStateIcon; tone?: EmptyStateTone; compact?: boolean; className?: string }

const toneClasses: Record<EmptyStateTone, { bg: string; text: string; message: string }> = {
  neutral: { bg: 'bg-canvas-border/60', text: 'text-ink-soft', message: 'text-ink' },
  success: { bg: 'bg-brand-soft', text: 'text-brand-dark', message: 'text-brand-dark' },
  danger: { bg: 'bg-danger-soft', text: 'text-danger', message: 'text-danger' },
}

const iconProps = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className: 'h-5 w-5', 'aria-hidden': true }
function SuccessIcon() { return <svg {...iconProps}><circle cx="12" cy="12" r="8.5" /><path d="m8.5 12.5 2.3 2.3 4.7-5.3" /></svg> }
function CalendarIcon() { return <svg {...iconProps}><rect x="3.5" y="4.5" width="17" height="16" rx="2" /><path d="M3.5 9.5h17M8 3v3M16 3v3M7.5 13.5h3v3h-3z" /></svg> }
function NotificationsIcon() { return <svg {...iconProps}><path d="M6 10.5a6 6 0 0 1 12 0v4l1.5 2.5h-15L6 14.5zM10 19.5a2 2 0 0 0 4 0" /></svg> }
function TasksIcon() { return <svg {...iconProps}><rect x="5" y="3.5" width="14" height="17" rx="2" /><path d="M9 3.5V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v.5m-6.5 8 2 2L15 9" /></svg> }
function ActivityIcon() { return <svg {...iconProps}><path d="M3.5 12h4l2-6 4 12 2-6h5" /></svg> }
const icons: Record<EmptyStateIcon, () => ReactElement> = { success: SuccessIcon, calendar: CalendarIcon, notifications: NotificationsIcon, tasks: TasksIcon, activity: ActivityIcon }

export default function DashboardEmptyState({ message, description, icon, tone = 'neutral', compact = false, className = '' }: DashboardEmptyStateProps) {
  const Icon = icons[icon]
  const colors = toneClasses[tone]
  if (compact) return (
    <div className={['flex items-center gap-3 rounded-lg px-3 py-2.5', colors.bg, className].filter(Boolean).join(' ')}>
      <span className={['flex h-8 w-8 shrink-0 items-center justify-center rounded-full', colors.text].join(' ')}><Icon /></span>
      <div className="min-w-0"><p className={['break-words text-sm font-medium', colors.message].join(' ')}>{message}</p>{description ? <p className="break-words text-xs text-ink-soft">{description}</p> : null}</div>
    </div>
  )
  return (
    <div className={['flex flex-col items-center gap-2 rounded-lg px-4 py-6 text-center', colors.bg, className].filter(Boolean).join(' ')}>
      <span className={['flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-canvas-surface', colors.text].join(' ')}><Icon /></span>
      <p className={['text-sm font-medium', colors.message].join(' ')}>{message}</p>
      {description ? <p className="text-xs text-ink-soft">{description}</p> : null}
    </div>
  )
}
