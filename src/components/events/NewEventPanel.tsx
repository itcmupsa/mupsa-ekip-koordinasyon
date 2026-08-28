import { useEffect, useRef, type FormEvent } from 'react'

export interface EventCoordinatorOption {
  profileId: string
  displayName: string
  coordinatorRoleName: string | null
}

interface NewEventPanelProps {
  isOpen: boolean
  title: string
  description: string
  planningDate: string
  estimatedDate: string
  preparationStartDate: string
  coordinatorOptions: EventCoordinatorOption[]
  hasSharedCoordinator: boolean
  selectedCoordinatorProfileIds: string[]
  error: string | null
  submitting: boolean
  onTitleChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onPlanningDateChange: (value: string) => void
  onEstimatedDateChange: (value: string) => void
  onPreparationStartDateChange: (value: string) => void
  onSharedCoordinatorChange: (value: boolean) => void
  onToggleCoordinator: (profileId: string) => void
  onSubmit: () => void
  onClose: () => void
}

type EventFormProps = Omit<NewEventPanelProps, 'isOpen' | 'onClose'> & {
  desktop?: boolean
}

const FOCUSABLE_SELECTOR = 'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
const fieldClass = 'min-h-[44px] rounded-lg border border-canvas-border bg-canvas-surface px-3 py-2.5 font-normal text-ink placeholder:text-ink-soft/70 focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/15 disabled:cursor-not-allowed disabled:opacity-60'

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
  preparationStartDate,
  coordinatorOptions,
  hasSharedCoordinator,
  selectedCoordinatorProfileIds,
  error,
  submitting,
  onTitleChange,
  onDescriptionChange,
  onPlanningDateChange,
  onEstimatedDateChange,
  onPreparationStartDateChange,
  onSharedCoordinatorChange,
  onToggleCoordinator,
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
        <div className="grid gap-4">
          <section className="rounded-xl border border-canvas-border bg-canvas p-4 sm:p-5">
            <div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-sm font-semibold text-brand-dark">1</span><div><h3 className="text-sm font-semibold text-ink">Temel bilgiler</h3><p className="mt-0.5 text-xs text-ink-soft">Etkinliğin adı ve kısa açıklaması.</p></div></div>
            <div className="mt-4 grid gap-4">
              <label className="grid gap-1.5 text-sm font-medium text-ink">
                Etkinlik adı
                <input value={title} onChange={(event) => onTitleChange(event.target.value)} placeholder="Örn. Dünya Sağlık Günü etkinliği" disabled={submitting} className={fieldClass} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-ink">
                <span>Açıklama <span className="text-xs font-normal text-ink-soft">(isteğe bağlı)</span></span>
                <textarea value={description} onChange={(event) => onDescriptionChange(event.target.value)} placeholder="Etkinlik hakkında kısa bir açıklama yazın…" rows={desktop ? 4 : 5} disabled={submitting} className={`${fieldClass} resize-y`} />
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-canvas-border bg-canvas p-4 sm:p-5">
            <div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-sm font-semibold text-amber-800">2</span><div><h3 className="text-sm font-semibold text-ink">Tarih planlaması</h3><p className="mt-0.5 text-xs text-ink-soft">Planlama, hazırlık ve tahmini etkinlik tarihlerini belirleyin.</p></div></div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium text-ink">Planlama tarihi<input type="date" value={planningDate} onChange={(event) => onPlanningDateChange(event.target.value)} disabled={submitting} className={fieldClass} /></label>
              <label className="grid gap-1.5 text-sm font-medium text-ink">Tahmini etkinlik tarihi<input type="date" value={estimatedDate} onChange={(event) => onEstimatedDateChange(event.target.value)} disabled={submitting} className={fieldClass} /></label>
              <label className="grid gap-1.5 text-sm font-medium text-ink sm:col-span-2"><span>Hazırlık başlangıç tarihi <span className="text-xs font-normal text-ink-soft">(isteğe bağlı)</span></span><input type="date" value={preparationStartDate} onChange={(event) => onPreparationStartDateChange(event.target.value)} disabled={submitting} className={fieldClass} /></label>
            </div>
          </section>

          <section className="rounded-xl border border-canvas-border bg-canvas p-4 sm:p-5">
            <div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-sm font-semibold text-brand-dark">3</span><div><h3 className="text-sm font-semibold text-ink">Ortak koordinatörler</h3><p className="mt-0.5 text-xs text-ink-soft">Etkinlik başka bir koordinatörlükle ortaksa ilgili kişileri birlikte yönetici olarak ekleyebilirsiniz.</p></div></div>

            <fieldset className="mt-4">
              <legend className="text-sm font-semibold text-ink">Ortak koordinatör var mı?</legend>
              <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Ortak koordinatör var mı?">
                <label className={`flex min-h-[48px] cursor-pointer items-center justify-center rounded-lg border px-4 text-sm font-semibold transition ${!hasSharedCoordinator ? 'border-brand bg-brand-soft text-brand-dark' : 'border-canvas-border bg-canvas-surface text-ink-soft hover:border-brand/40'}`}>
                  <input type="radio" name="has-shared-coordinator" checked={!hasSharedCoordinator} onChange={() => onSharedCoordinatorChange(false)} disabled={submitting} className="sr-only" />
                  Hayır
                </label>
                <label className={`flex min-h-[48px] cursor-pointer items-center justify-center rounded-lg border px-4 text-sm font-semibold transition ${hasSharedCoordinator ? 'border-brand bg-brand-soft text-brand-dark' : 'border-canvas-border bg-canvas-surface text-ink-soft hover:border-brand/40'}`}>
                  <input type="radio" name="has-shared-coordinator" checked={hasSharedCoordinator} onChange={() => onSharedCoordinatorChange(true)} disabled={submitting} className="sr-only" />
                  Evet
                </label>
              </div>
            </fieldset>

            {hasSharedCoordinator ? (
              coordinatorOptions.length === 0 ? (
                <p className="mt-4 rounded-lg border border-canvas-border bg-canvas-surface px-3 py-3 text-sm text-ink-soft">Aktif dönemde seçilebilecek başka koordinatör bulunmuyor.</p>
              ) : (
                <div className="mt-4">
                  <p className="text-xs font-medium text-ink-soft">Bir veya daha fazla ortak koordinatör seçebilirsiniz.</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {coordinatorOptions.map((member) => {
                      const checked = selectedCoordinatorProfileIds.includes(member.profileId)
                      return (
                        <label key={member.profileId} className={`flex min-h-[60px] cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition ${checked ? 'border-brand bg-brand-soft/60' : 'border-canvas-border bg-canvas-surface hover:border-brand/40'}`}>
                          <input type="checkbox" checked={checked} onChange={() => onToggleCoordinator(member.profileId)} disabled={submitting} className="h-4 w-4 shrink-0 accent-brand" />
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-semibold uppercase tracking-wide text-brand-dark">{member.coordinatorRoleName ?? 'Koordinatör'}</span>
                            <span className="mt-0.5 block truncate text-sm font-semibold text-ink">{member.displayName}</span>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )
            ) : (
              <p className="mt-3 text-xs text-ink-soft">Hayır seçiliyken etkinlik yalnız ana koordinatör üzerinden oluşturulur.</p>
            )}
          </section>
        </div>

        {error ? (
          <p role="alert" className="mt-5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
      </div>

      <div className={desktop ? 'shrink-0 border-t border-canvas-border bg-canvas px-6 py-4' : 'mt-5'}>
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
  preparationStartDate,
  coordinatorOptions,
  hasSharedCoordinator,
  selectedCoordinatorProfileIds,
  error,
  submitting,
  onTitleChange,
  onDescriptionChange,
  onPlanningDateChange,
  onEstimatedDateChange,
  onPreparationStartDateChange,
  onSharedCoordinatorChange,
  onToggleCoordinator,
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
    preparationStartDate,
    coordinatorOptions,
    hasSharedCoordinator,
    selectedCoordinatorProfileIds,
    error,
    submitting,
    onTitleChange,
    onDescriptionChange,
    onPlanningDateChange,
    onEstimatedDateChange,
    onPreparationStartDateChange,
    onSharedCoordinatorChange,
    onToggleCoordinator,
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
