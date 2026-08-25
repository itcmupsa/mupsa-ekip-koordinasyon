export type NavigationIconName = 'home' | 'tasks' | 'events' | 'calendar' | 'awareness' | 'team' | 'settings' | 'account' | 'signout'

interface NavigationIconProps {
  name: NavigationIconName
  className?: string
  strokeWidth?: number
}

export default function NavigationIcon({ name, className = 'h-6 w-6', strokeWidth = 1.8 }: NavigationIconProps) {
  const commonProps = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true,
  }

  if (name === 'home') return <svg {...commonProps}><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1v-9" /></svg>
  if (name === 'tasks') return <svg {...commonProps}><rect x="4" y="3.5" width="16" height="17" rx="2.5" /><path d="m7.5 9 1.5 1.5 2.5-3M7.5 15l1.5 1.5 2.5-3M14 9h3M14 15h3" /></svg>
  if (name === 'events') return <svg {...commonProps}><rect x="3.5" y="4.5" width="17" height="16" rx="2.5" /><path d="M3.5 9.5h17M8 3v3M16 3v3" /><path d="m12 12.2.8 1.7 1.9.3-1.4 1.3.4 1.9-1.7-.9-1.7.9.4-1.9-1.4-1.3 1.9-.3z" /></svg>
  if (name === 'calendar') return <svg {...commonProps}><rect x="3.5" y="4.5" width="17" height="16" rx="2.5" /><path d="M3.5 9.5h17M8 3v3M16 3v3M7.5 13h1M11.5 13h1M15.5 13h1M7.5 16.5h1M11.5 16.5h1M15.5 16.5h1" /></svg>
  if (name === 'awareness') return <svg {...commonProps}><path d="M19.5 4.5C13 4.7 8.5 7.2 8.5 12.1c0 2.9 2 5 4.8 5 4.8 0 6.7-5.8 6.2-12.6Z" /><path d="M4.5 20c1.8-4.9 5.1-8.2 10.4-10.4" /><path d="m5 5 .45 1.35L6.8 6.8l-1.35.45L5 8.6l-.45-1.35L3.2 6.8l1.35-.45z" /></svg>
  if (name === 'team') return <svg {...commonProps}><circle cx="9" cy="8" r="3" /><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" /><circle cx="17" cy="7.5" r="2.25" /><path d="M15.5 12.3a4.3 4.3 0 0 1 5 4.2" /></svg>
  if (name === 'settings') return <svg {...commonProps}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21h-4v-.08a1.7 1.7 0 0 0-1.04-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.04H3v-4h.1A1.7 1.7 0 0 0 4.6 8.92a1.7 1.7 0 0 0-.34-1.87L4.2 7l2.83-2.83.06.06A1.7 1.7 0 0 0 8.96 4.6 1.7 1.7 0 0 0 10 3.04V3h4v.1a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06L19.8 7l-.06.06a1.7 1.7 0 0 0-.34 1.87 1.7 1.7 0 0 0 1.56 1.04H21v4h-.1A1.7 1.7 0 0 0 19.4 15z" /></svg>
  if (name === 'account') return <svg {...commonProps}><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></svg>
  return <svg {...commonProps}><path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3M15 8l4 4-4 4M19 12H9" /></svg>
}
