import { Link } from 'react-router-dom'
import NavigationIcon from './navigation/NavigationIcon'

interface MobileHeaderProps {
  displayName: string
}

export default function MobileHeader({ displayName }: MobileHeaderProps) {
  return (
    <header
      className="sticky top-0 z-30 w-full bg-brand-dark text-white lg:hidden"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="flex h-16 items-center justify-between px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white p-1 shadow-sm ring-1 ring-white/30">
            <img src="/mupsa-logo.svg" alt="" className="h-full w-full object-contain" />
          </span>
          <span className="truncate text-base font-semibold tracking-tight">MUPSA</span>
        </div>

        <Link
          to="/app/ayarlar"
          aria-label={`${displayName} hesabına git`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-dark"
        >
          <NavigationIcon name="account" />
        </Link>
      </div>
    </header>
  )
}
