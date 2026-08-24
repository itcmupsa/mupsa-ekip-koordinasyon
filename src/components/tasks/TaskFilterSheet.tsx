import { useEffect, useRef } from 'react'

interface StatusOption {
  slug: string
  label: string
}

type ContextFilter = 'all' | 'event' | 'awareness' | 'standalone'

interface TaskFilterSheetProps {
  isOpen: boolean
  isSuperAdmin: boolean
  contextFilter: ContextFilter
  statusFilter: string
  showInactive: boolean
  statuses: StatusOption[]
  onContextFilterChange: (value: ContextFilter) => void
  onStatusFilterChange: (value: string) => void
  onShowInactiveChange: (value: boolean) => void
  onClose: () => void
}

const FOCUSABLE_SELECTOR = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

function CloseIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
}

function FilterIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><path d="M4 5h16l-6 7v5l-4 2v-7z" /></svg>
}

export default function TaskFilterSheet({
  isOpen,
  isSuperAdmin,
  contextFilter,
  statusFilter,
  showInactive,
  statuses,
  onContextFilterChange,
  onStatusFilterChange,
  onShowInactiveChange,
  onClose,
}: TaskFilterSheetProps) {
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

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button type="button" aria-label="Filtreleri kapat" tabIndex={-1} onClick={onClose} className="absolute inset-0 bg-ink/40" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-filter-title"
        className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-canvas-surface shadow-card"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between border-b border-canvas-border px-4 py-3">
          <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand-dark"><FilterIcon /></span><div><h2 id="task-filter-title" className="text-base font-semibold text-ink">Görev filtreleri</h2><p className="mt-0.5 text-xs text-ink-soft">Gösterilecek görevleri daraltın.</p></div></div>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Kapat" className="flex h-11 w-11 items-center justify-center rounded-lg border border-canvas-border text-ink hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"><CloseIcon /></button>
        </div>

        <div className="grid gap-3 px-4 py-5">
          <label className="grid gap-1.5 rounded-xl border border-canvas-border bg-canvas p-3.5 text-sm font-medium text-ink">
            Bağlı kayıt türü
            <select value={contextFilter} onChange={(event) => onContextFilterChange(event.target.value as ContextFilter)} className="min-h-[44px] rounded-lg border border-canvas-border bg-canvas-surface px-3 py-2 font-normal outline-none focus:border-brand focus:ring-2 focus:ring-brand/10">
              <option value="all">Tüm bağlı kayıtlar</option>
              <option value="event">Etkinlik görevleri</option>
              <option value="awareness">Farkındalık görevleri</option>
              <option value="standalone">Bağımsız görevler</option>
            </select>
          </label>

          <label className="grid gap-1.5 rounded-xl border border-canvas-border bg-canvas p-3.5 text-sm font-medium text-ink">
            Durum
            <select value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)} className="min-h-[44px] rounded-lg border border-canvas-border bg-canvas-surface px-3 py-2 font-normal outline-none focus:border-brand focus:ring-2 focus:ring-brand/10">
              <option value="all">Tüm durumlar</option>
              {statuses.map((status) => <option key={status.slug} value={status.slug}>{status.label}</option>)}
            </select>
          </label>

          {isSuperAdmin ? (
            <label className="flex min-h-[52px] items-center gap-3 rounded-xl border border-canvas-border bg-canvas px-3.5 text-sm font-medium text-ink">
              <input type="checkbox" checked={showInactive} onChange={(event) => onShowInactiveChange(event.target.checked)} className="h-5 w-5 accent-brand" />
              Pasif görevleri göster
            </label>
          ) : null}

          <button type="button" onClick={onClose} className="mt-1 flex min-h-[48px] items-center justify-center rounded-lg bg-brand-dark px-4 text-sm font-semibold text-white shadow-card">Filtreleri uygula</button>
        </div>
      </div>
    </div>
  )
}
