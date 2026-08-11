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

type EventFormProps = Omit<NewEventPanelProps, 'isOpen' | 'onClose'> & {
  desktop?: boolean
}

const FOCUSABLE_SELECTOR = 'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
const fieldClass = 'min-h-[44px] rounded-lg border border-canvas-border bg-canvas-surface px-3 py-2.5 font-normal text-ink placeholder:text-ink-soft/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-60'

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  )
}

function EventIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
      <rect x="3.5" y="4.5" width="15" height="16" rx="2" />
      <path d="M3.5 9.5h15M8 3v3M14 3v3M19 15h4M21 13v4" />
    </svg>
  )
}

function EventForm({
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
  desktop = false,
}: EventFormProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit()
  }

  return (
    <form onSubmit={handleSubmit} className={desktop ? 'flex min-h-0 flex-1 flex-col' : 'mt-5'}>
      <div className={desktop ? 'flex-1 overflow-y-auto px-6 py-5' : ''}>
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
            Açıklama (isteğe bağlı)
            <textarea
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
              placeholder="Etkinlik hakkında kısa bir açıklama yazın…"
              rows={desktop ? 4 : 5}
              disabled={submitting}
              className={`${fieldClass} resize-y`}
            />
          </label>

          <div className="grid gap-5 sm:grid-cols-2 sm:gap-4">
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

      <div className={desktop ? 'shrink-0 border-t border-canvas-border px-6 py-4' : 'mt-5'}>
        <button
          type="submit"
          disabled={submitting}
          className="flex min-h-[44px] w-full items-center justify-center rounded-lg bg-accent px-5 text-sm font-semibold text-white shadow-card transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Oluşturuluyor…' : 'Etkinliği oluştur'}
        </button>
      </div>
    </form>
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
  const desktopPanelRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isOpen || !window.matchMedia('(min-width: 1024px)').matches) return

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

      const panel = desktopPanelRef.current
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

  const formProps = {
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
  }

  return (
    <>
      <section
        id="new-event-mobile-form"
        aria-labelledby="new-event-mobile-title"
        className="mt-5 rounded-xl border border-canvas-border bg-canvas-surface p-4 shadow-card lg:hidden"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-amber-800"><EventIcon /></span>
            <h2 id="new-event-mobile-title" className="truncate text-lg font-semibold text-ink">Yeni etkinlik</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Yeni etkinlik formunu kapat"
            className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-ink-soft hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60"
          >
            <span className="hidden min-[360px]:inline">Kapat</span>
            <CloseIcon />
          </button>
        </div>
        <EventForm {...formProps} />
      </section>

      <div className="fixed inset-0 z-50 hidden items-center justify-center bg-ink/45 p-6 backdrop-blur-[1px] lg:flex lg:pl-[calc(15rem+1.5rem)]">
        <button type="button" aria-label="Yeni etkinlik penceresini kapat" tabIndex={-1} onClick={onClose} disabled={submitting} className="absolute inset-0 disabled:cursor-wait" />
        <div
          ref={desktopPanelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-event-desktop-title"
          className="relative flex max-h-[calc(100vh-3rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-canvas-surface shadow-2xl"
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-canvas-border px-6 py-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-amber-800"><EventIcon /></span>
              <div>
                <h2 id="new-event-desktop-title" className="text-lg font-semibold text-ink">Yeni etkinlik</h2>
                <p className="mt-0.5 text-xs text-ink-soft">Aktif dönem için yeni bir etkinlik kaydı oluştur.</p>
              </div>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              disabled={submitting}
              aria-label="Kapat"
              className="flex min-h-[44px] shrink-0 items-center gap-2 rounded-md px-2 text-sm font-medium text-ink-soft hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60"
            >
              <span>Kapat</span>
              <CloseIcon />
            </button>
          </div>
          <EventForm {...formProps} desktop />
        </div>
      </div>
    </>
  )
}
