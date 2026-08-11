import { Link } from 'react-router-dom'

interface MobileHeaderProps {
  displayName: string
}

function ProfileIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </svg>
  )
}

export default function MobileHeader({ displayName }: MobileHeaderProps) {
  return (
    <header
      className="sticky top-0 z-30 w-full bg-brand-dark text-white lg:hidden"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="flex h-16 items-center justify-between px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <img src="/mupsa-logo.svg" alt="" className="h-10 w-10 shrink-0 rounded-full bg-white p-0.5" />
          <span className="truncate text-base font-semibold tracking-tight">MUPSA</span>
        </div>

        <Link
          to="/app/ayarlar"
          aria-label={`${displayName} hesabına git`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-dark"
        >
          <ProfileIcon />
        </Link>
      </div>
    </header>
  )
}
