interface ResponsibilityLabelProps {
  label: string
  className?: string
}

function PersonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5 shrink-0"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </svg>
  )
}

export default function ResponsibilityLabel({ label, className = '' }: ResponsibilityLabelProps) {
  return (
    <span className={[
      'inline-flex items-center gap-1.5 text-xs font-medium leading-none text-ink-soft',
      className,
    ].filter(Boolean).join(' ')}>
      <PersonIcon />
      <span>{label}</span>
    </span>
  )
}
