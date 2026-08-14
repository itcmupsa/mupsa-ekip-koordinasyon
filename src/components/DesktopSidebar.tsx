import { Link, NavLink } from 'react-router-dom'

interface DesktopSidebarProps {
  isSuperAdmin: boolean
  displayName: string
  roleLabel: string
  onSignOut: () => void
}

type IconName = 'home' | 'tasks' | 'events' | 'calendar' | 'awareness' | 'team' | 'settings' | 'account' | 'signout'

interface NavItem {
  label: string
  to: string
  end?: boolean
  icon: IconName
}

function Icon({ name }: { name: IconName }) {
  const commonProps = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: 'h-6 w-6',
    'aria-hidden': true,
  }

  if (name === 'home') return <svg {...commonProps}><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1v-9" /></svg>
  if (name === 'tasks') return <svg {...commonProps}><rect x="4" y="3.5" width="16" height="17" rx="2.5" /><path d="m7.5 9 1.5 1.5 2.5-3M7.5 15l1.5 1.5 2.5-3M14 9h3M14 15h3" /></svg>
  if (name === 'events') return <svg {...commonProps}><rect x="3.5" y="4.5" width="17" height="16" rx="2.5" /><path d="M3.5 9.5h17M8 3v3M16 3v3" /><path d="m12 12.2.8 1.7 1.9.3-1.4 1.3.4 1.9-1.7-.9-1.7.9.4-1.9-1.4-1.3 1.9-.3z" /></svg>
  if (name === 'calendar') return <svg {...commonProps}><rect x="3.5" y="4.5" width="17" height="16" rx="2.5" /><path d="M3.5 9.5h17M8 3v3M16 3v3M7.5 13h1M11.5 13h1M15.5 13h1M7.5 16.5h1M11.5 16.5h1M15.5 16.5h1" /></svg>
  if (name === 'awareness') return <svg {...commonProps}><path d="M12 4.5a6 6 0 1 1 0 12 6 6 0 0 1 0-12z" /><path d="M12 8v5M9.5 10.5h5M8.2 15.2 7 20l5-2 5 2-1.2-4.8M16.5 3.5l.5-1.5.5 1.5L19 4l-1.5.5L17 6l-.5-1.5L15 4z" /></svg>
  if (name === 'team') return <svg {...commonProps}><circle cx="9" cy="8" r="3" /><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" /><circle cx="17" cy="7.5" r="2.25" /><path d="M15.5 12.3a4.3 4.3 0 0 1 5 4.2" /></svg>
  if (name === 'settings') return <svg {...commonProps}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21h-4v-.08a1.7 1.7 0 0 0-1.04-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.04H3v-4h.1A1.7 1.7 0 0 0 4.6 8.92a1.7 1.7 0 0 0-.34-1.87L4.2 7l2.83-2.83.06.06A1.7 1.7 0 0 0 8.96 4.6 1.7 1.7 0 0 0 10 3.04V3h4v.1a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06L19.8 7l-.06.06a1.7 1.7 0 0 0-.34 1.87 1.7 1.7 0 0 0 1.56 1.04H21v4h-.1A1.7 1.7 0 0 0 19.4 15z" /></svg>
  if (name === 'account') return <svg {...commonProps}><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></svg>
  return <svg {...commonProps}><path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3M15 8l4 4-4 4M19 12H9" /></svg>
}

const baseNavItems: NavItem[] = [
  { label: 'Ana Sayfa', to: '/app', end: true, icon: 'home' },
  { label: 'Görevler', to: '/app/gorevler', icon: 'tasks' },
  { label: 'Etkinlikler', to: '/app/etkinlikler', icon: 'events' },
  { label: 'Takvim', to: '/app/takvim', icon: 'calendar' },
  { label: 'Farkındalık', to: '/app/farkindalik', icon: 'awareness' },
]

const adminNavItem: NavItem = { label: 'Ekip Yönetimi', to: '/app/yonetim/uyeler', icon: 'team' }
const settingsNavItem: NavItem = { label: 'Ayarlar', to: '/app/ayarlar', icon: 'settings' }

function initialsFor(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0]?.charAt(0) ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1]?.charAt(0) ?? '' : ''
  return `${first}${last}`.toLocaleUpperCase('tr-TR')
}

const navLinkClass = ({ isActive }: { isActive: boolean }) => [
  'flex min-h-[52px] items-center gap-4 rounded-xl px-4 py-3 text-[15px] font-medium transition-colors',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-dark',
  isActive ? 'bg-white/15 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white',
].join(' ')

export default function DesktopSidebar({ isSuperAdmin, displayName, roleLabel, onSignOut }: DesktopSidebarProps) {
  const navItems = isSuperAdmin
    ? [...baseNavItems, adminNavItem, settingsNavItem]
    : [...baseNavItems, settingsNavItem]

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden h-full w-60 flex-col bg-brand-dark text-white lg:flex" aria-label="Ana menü">
      <div className="flex items-center gap-3.5 px-5 pb-6 pt-6">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white p-1.5 shadow-sm ring-1 ring-white/30">
          <img src="/mupsa-logo.svg" alt="" className="h-full w-full object-contain" />
        </span>
        <div className="min-w-0">
          <p className="text-lg font-semibold leading-tight tracking-tight">MUPSA</p>
          <p className="mt-0.5 text-[13px] leading-tight text-white/70">Ekip Koordinasyon</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <ul className="flex flex-col gap-1.5">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.end} className={navLinkClass}>
                <span className="shrink-0"><Icon name={item.icon} /></span>
                <span className="truncate">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-white/10 px-3 py-4">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-semibold" aria-hidden="true">
            {initialsFor(displayName)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium leading-tight text-white">{displayName}</p>
            <p className="truncate text-xs leading-tight text-white/65">{roleLabel}</p>
          </div>
        </div>

        <div className="mt-2 flex flex-col gap-1">
          <Link
            to="/app/ayarlar"
            className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-dark"
          >
            <span className="shrink-0"><Icon name="account" /></span>
            <span className="truncate">Hesabım</span>
          </Link>
          <button
            type="button"
            onClick={onSignOut}
            className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-dark"
          >
            <span className="shrink-0"><Icon name="signout" /></span>
            <span className="truncate">Çıkış yap</span>
          </button>
        </div>
      </div>
    </aside>
  )
}
