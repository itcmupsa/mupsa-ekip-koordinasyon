export type TaskStatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

interface TaskStatusBadgeProps {
  label: string
  tone?: TaskStatusTone
  className?: string
}

const toneClasses: Record<TaskStatusTone, string> = {
  neutral: 'bg-canvas-border/60 text-ink-soft',
  success: 'bg-brand-soft text-brand-dark',
  warning: 'bg-accent-soft text-amber-800',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-sky-100 text-sky-700',
}

export default function TaskStatusBadge({ label, tone = 'neutral', className = '' }: TaskStatusBadgeProps) {
  return (
    <span
      className={[
        'inline-flex max-w-full items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium leading-none',
        toneClasses[tone],
        className,
      ].filter(Boolean).join(' ')}
    >
      {label}
    </span>
  )
}
