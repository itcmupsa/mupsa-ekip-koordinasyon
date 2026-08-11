import { useEffect, useRef, type FormEvent } from 'react'

interface NewEventPanelProps {
  isOpen: boolean
  title: string
  description: string
  planningDate: string
  estimatedDate: string
  error: string | null
  submitting: boolean
  onTitleChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onPlanningDateChange: (value: string) => void
  onEstimatedDateChange: (value: string) => void
  onSubmit: () => void
  onClose: () => void
}

const FOCUSABLE_SELECTOR = 'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
const fieldClass = 'min-h-[44px] rounded-md border border-canvas-border bg-canvas-surface px-3 py-2 font-normal text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand'

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  )
}

export default function NewEventPanel({
  isOpen,
  title,
  description,
  planningDate,
  estimatedDate,
  error,
  submitting,
  onTitleChange,
  onDescriptionChange,
  onPlanningDateChange,
  onEstimatedDateChange,
  onSubmit,
  onClose,
}: NewEventPanelProps) {
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
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => element.offsetParent !== null,
      )
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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit()
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Yeni etkinlik panelini kapat"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-y-0 left-60 right-0 hidden bg-ink/35 backdrop-blur-[1px] lg:block"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-event-title"
        className="absolute inset-0 flex flex-col bg-canvas-surface shadow-2xl lg:inset-y-0 lg:left-auto lg:right-0 lg:w-full lg:max-w-[540px]"
      >
        <div className="shrink-0 lg:hidden" style={{ height: 'env(safe-area-inset-top)' }} />
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-canvas-border px-4 py-3 lg:px-6 lg:py-5">
          <div>
            <h2 id="new-event-title" className="text-base font-semibold text-brand-dark lg:text-lg">Yeni etkinlik oluştur</h2>
            <p className="mt-0.5 text-xs text-ink-soft">Aktif dönem için yeni bir etkinlik kaydı oluştur.</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            <CloseIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-5 lg:px-6 lg:py-6">
            <div className="grid gap-5">
              <label className="grid gap-1.5 text-sm font-medium text-ink">
                Etkinlik adı
                <input
                  value={title}
                  onChange={(event) => onTitleChange(event.target.value)}
                  placeholder="Örn. Dünya Sağlık Günü etkinliği"
                  disabled={submitting}
                  className={fieldClass}
                />
              </label>

              <label className="grid gap-1.5 text-sm font-medium text-ink">
                Açıklama <span className="font-normal text-ink-soft">(isteğe bağlı)</span>
                <textarea
                  value={description}
                  onChange={(event) => onDescriptionChange(event.target.value)}
                  rows={5}
                  disabled={submitting}
                  className={`${fieldClass} resize-y`}
                />
              </label>

              <div className="grid gap-5 lg:grid-cols-2 lg:gap-4">
                <label className="grid gap-1.5 text-sm font-medium text-ink">
                  Planlama tarihi
                  <input
                    type="date"
                    value={planningDate}
                    onChange={(event) => onPlanningDateChange(event.target.value)}
                    disabled={submitting}
                    className={fieldClass}
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-ink">
                  Tahmini etkinlik tarihi
                  <input
                    type="date"
                    value={estimatedDate}
                    onChange={(event) => onEstimatedDateChange(event.target.value)}
                    disabled={submitting}
                    className={fieldClass}
                  />
                </label>
              </div>
            </div>

            {error ? (
              <p role="alert" className="mt-5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-canvas-border bg-canvas-surface px-4 pt-3 lg:px-6 lg:py-4">
            <div className="flex items-center gap-3 lg:justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-md border border-canvas-border bg-canvas-surface px-4 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-60 lg:flex-none"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-md bg-accent px-5 text-sm font-semibold text-white shadow-card hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 lg:flex-none"
              >
                {submitting ? 'Oluşturuluyor…' : 'Etkinliği oluştur'}
              </button>
            </div>
            <div className="lg:hidden" style={{ height: 'env(safe-area-inset-bottom)' }} />
          </div>
        </form>
      </div>
    </div>
  )
}
