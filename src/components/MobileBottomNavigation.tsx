import { NavLink, useLocation } from 'react-router-dom'
import NavigationIcon from './navigation/NavigationIcon'

interface MobileBottomNavigationProps {
  isMoreOpen: boolean
  onMoreClick: () => void
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
          {({ isActive }) => <><NavigationIcon name="home" className="h-5 w-5" strokeWidth={isActive ? 2 : 1.75} /><span>Ana Sayfa</span></>}
        </NavLink>
        <NavLink to="/app/gorevler" className={({ isActive }) => itemClass(isActive)}>
          {({ isActive }) => <><NavigationIcon name="tasks" className="h-5 w-5" strokeWidth={isActive ? 2 : 1.75} /><span>Görevler</span></>}
        </NavLink>
        <NavLink to="/app/takvim" className={({ isActive }) => itemClass(isActive)}>
          {({ isActive }) => <><NavigationIcon name="calendar" className="h-5 w-5" strokeWidth={isActive ? 2 : 1.75} /><span>Takvim</span></>}
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
