import { NavLink, useLocation } from 'react-router-dom'

interface MobileBottomNavigationProps {
  isMoreOpen: boolean
  onMoreClick: () => void
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.75} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1v-9" />
    </svg>
  )
}

function TasksIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.75} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <rect x="5" y="3.5" width="14" height="17" rx="2" />
      <path d="M9 3.5V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v.5" />
      <path d="m8.5 11.5 2 2L15 9" />
    </svg>
  )
}

function CalendarIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.75} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="16" rx="2" />
      <path d="M3.5 9.5h17M8 3v3M16 3v3M7.5 13.5h3v3h-3z" />
    </svg>
  )
}

function MoreIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.75} className="h-5 w-5" aria-hidden="true">
      <rect x="4" y="4" width="6" height="6" rx="1.5" />
      <rect x="14" y="4" width="6" height="6" rx="1.5" />
      <rect x="4" y="14" width="6" height="6" rx="1.5" />
      <rect x="14" y="14" width="6" height="6" rx="1.5" />
    </svg>
  )
}

const morePaths = ['/app/etkinlikler', '/app/farkindalik', '/app/ayarlar', '/app/yonetim/uyeler']

export default function MobileBottomNavigation({ isMoreOpen, onMoreClick }: MobileBottomNavigationProps) {
  const location = useLocation()
  const isMoreActive = isMoreOpen || morePaths.some((path) => location.pathname.startsWith(path))

  const itemClass = (isActive: boolean) => [
    'flex min-h-[44px] flex-1 flex-col items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
    isActive ? 'bg-brand-soft text-brand-dark' : 'text-ink-soft hover:text-ink',
  ].join(' ')

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-canvas-border bg-canvas-surface shadow-card lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Mobil alt gezinme"
    >
      <div className="flex items-stretch justify-between px-2 py-1.5">
        <NavLink to="/app" end className={({ isActive }) => itemClass(isActive)}>
          {({ isActive }) => <><HomeIcon active={isActive} /><span>Ana Sayfa</span></>}
        </NavLink>
        <NavLink to="/app/gorevler" className={({ isActive }) => itemClass(isActive)}>
          {({ isActive }) => <><TasksIcon active={isActive} /><span>Görevler</span></>}
        </NavLink>
        <NavLink to="/app/takvim" className={({ isActive }) => itemClass(isActive)}>
          {({ isActive }) => <><CalendarIcon active={isActive} /><span>Takvim</span></>}
        </NavLink>
        <button
          type="button"
          onClick={onMoreClick}
          aria-expanded={isMoreOpen}
          aria-controls="mobile-more-panel"
          className={itemClass(isMoreActive)}
        >
          <MoreIcon active={isMoreActive} />
          <span>Daha Fazla</span>
        </button>
      </div>
    </nav>
  )
}
