import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/app/takvimler/etkinlik', label: 'Etkinlik Takvimi' },
  { to: '/app/takvimler/farkindalik', label: 'Farkındalık Takvimi' },
  { to: '/app/takvimler/pr', label: 'PR Takvimi' },
]

export default function CalendarTabs() {
  return (
    <nav aria-label="Takvim türleri" className="mt-5 overflow-x-auto rounded-xl border border-canvas-border bg-canvas-surface p-1.5 shadow-card">
      <div className="flex min-w-max gap-1">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) => `min-h-[44px] rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${isActive ? 'bg-brand-dark text-white shadow-sm' : 'text-ink-soft hover:bg-canvas hover:text-ink'}`}
          >
            {tab.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
