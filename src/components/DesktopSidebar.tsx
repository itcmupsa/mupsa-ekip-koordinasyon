import { Link, NavLink } from 'react-router-dom'
import NavigationIcon, { type NavigationIconName } from './navigation/NavigationIcon'

interface DesktopSidebarProps {
  isSuperAdmin: boolean
  displayName: string
  roleLabel: string
  onSignOut: () => void
}

interface NavItem {
  label: string
  to: string
  end?: boolean
  icon: NavigationIconName
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
                <span className="shrink-0"><NavigationIcon name={item.icon} /></span>
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
            <span className="shrink-0"><NavigationIcon name="account" /></span>
            <span className="truncate">Hesabım</span>
          </Link>
          <button
            type="button"
            onClick={onSignOut}
            className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-dark"
          >
            <span className="shrink-0"><NavigationIcon name="signout" /></span>
            <span className="truncate">Çıkış yap</span>
          </button>
        </div>
      </div>
    </aside>
  )
}
