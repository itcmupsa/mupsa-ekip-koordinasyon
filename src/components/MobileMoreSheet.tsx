import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

interface MobileMoreSheetProps {
  isOpen: boolean
  isSuperAdmin: boolean
  onClose: () => void
}

type IconName = 'events' | 'awareness' | 'account' | 'team'

interface MoreLink {
  label: string
  to: string
  icon: IconName
}

function MenuIcon({ name }: { name: IconName }) {
  const props = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: 'h-5 w-5',
    'aria-hidden': true,
  }

  if (name === 'events') return <svg {...props}><rect x="3.5" y="4.5" width="17" height="16" rx="2" /><path d="M3.5 9.5h17M8 3v3M16 3v3" /><circle cx="9" cy="14" r="1" /><circle cx="12.5" cy="14" r="1" /><circle cx="16" cy="14" r="1" /></svg>
  if (name === 'awareness') return <svg {...props}><path d="M4 10v3a1 1 0 0 0 1 1h2l4.5 3.5v-11L7 10H5a1 1 0 0 0-1 1zM16.5 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11" /></svg>
  if (name === 'account') return <svg {...props}><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></svg>
  return <svg {...props}><circle cx="9" cy="8" r="3" /><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" /><circle cx="17" cy="7.5" r="2.25" /><path d="M15.5 12.3a4.3 4.3 0 0 1 5 4.2" /></svg>
}

function ChevronIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-ink-soft" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
}

function CloseIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
}

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

export default function MobileMoreSheet({ isOpen, isSuperAdmin, onClose }: MobileMoreSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isOpen) return

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null
    closeButtonRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const panel = panelRef.current
      if (!panel) return
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => element.offsetParent !== null)
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previouslyFocusedRef.current?.focus()
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const links: MoreLink[] = [
    { label: 'Etkinlikler', to: '/app/etkinlikler', icon: 'events' },
    { label: 'Farkındalık Paylaşımları', to: '/app/farkindalik', icon: 'awareness' },
    { label: 'Hesabım ve Ayarlar', to: '/app/ayarlar', icon: 'account' },
  ]
  if (isSuperAdmin) links.push({ label: 'Ekip Yönetimi', to: '/app/yonetim/uyeler', icon: 'team' })

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button type="button" aria-label="Paneli kapat" tabIndex={-1} onClick={onClose} className="absolute inset-0 bg-ink/40" />
      <div
        ref={panelRef}
        id="mobile-more-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Daha fazla menü"
        className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-canvas-surface shadow-card"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between border-b border-canvas-border px-4 py-3">
          <h2 className="text-base font-semibold text-brand-dark">Daha Fazla</h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            <CloseIcon />
          </button>
        </div>
        <nav aria-label="Daha fazla bağlantılar" className="px-2 py-2">
          <ul className="flex flex-col">
            {links.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  onClick={onClose}
                  className="flex min-h-[48px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-dark"><MenuIcon name={link.icon} /></span>
                  <span className="flex-1 truncate">{link.label}</span>
                  <ChevronIcon />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  )
}
