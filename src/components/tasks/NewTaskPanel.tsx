import { useEffect, useRef, type FormEvent } from 'react'

interface ContextOption {
  id: string
  title: string
}

interface MemberOption {
  id: string
  name: string
}

interface PriorityOption {
  value: string
  label: string
}

interface NewTaskPanelProps {
  isOpen: boolean
  isSuperAdmin: boolean
  contextSelection: string
  title: string
  description: string
  deadline: string
  priority: string
  primaryProfileId: string
  supportingProfileId: string
  informedProfileId: string
  events: ContextOption[]
  awarenessPosts: ContextOption[]
  members: MemberOption[]
  priorities: PriorityOption[]
  error: string | null
  saving: boolean
  onContextSelectionChange: (value: string) => void
  onTitleChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onDeadlineChange: (value: string) => void
  onPriorityChange: (value: string) => void
  onPrimaryProfileIdChange: (value: string) => void
  onSupportingProfileIdChange: (value: string) => void
  onInformedProfileIdChange: (value: string) => void
  contextKeyFor: (kind: 'event' | 'awareness', id: string) => string
  onSubmit: () => void
  onClose: () => void
}

const FOCUSABLE_SELECTOR = 'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
const fieldClass = 'min-h-[44px] rounded-lg border border-canvas-border bg-canvas-surface px-3 py-2.5 font-normal text-ink focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/15'

function CloseIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
}

function TaskIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><rect x="5" y="3.5" width="14" height="17" rx="2" /><path d="M8.5 11.5l2 2L15 9M9 3.5V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v.5" /></svg>
}

function PersonIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><circle cx="12" cy="8" r="3.25" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></svg>
}

export default function NewTaskPanel({
  isOpen,
  isSuperAdmin,
  contextSelection,
  title,
  description,
  deadline,
  priority,
  primaryProfileId,
  supportingProfileId,
  informedProfileId,
  events,
  awarenessPosts,
  members,
  priorities,
  error,
  saving,
  onContextSelectionChange,
  onTitleChange,
  onDescriptionChange,
  onDeadlineChange,
  onPriorityChange,
  onPrimaryProfileIdChange,
  onSupportingProfileIdChange,
  onInformedProfileIdChange,
  contextKeyFor,
  onSubmit,
  onClose,
}: NewTaskPanelProps) {
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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit()
  }

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="Yeni görev panelini kapat" tabIndex={-1} onClick={onClose} className="absolute inset-y-0 left-60 right-0 hidden bg-ink/35 backdrop-blur-[1px] lg:block" />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="new-task-title" className="absolute inset-0 flex flex-col bg-canvas-surface shadow-2xl lg:inset-y-0 lg:left-auto lg:right-0 lg:w-full lg:max-w-[640px]">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-canvas-border bg-canvas-surface px-4 pb-3 lg:px-6 lg:py-5" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}>
          <div className="flex min-w-0 items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-dark"><TaskIcon /></span><div className="min-w-0"><h2 id="new-task-title" className="truncate text-base font-semibold text-ink lg:text-lg">Yeni görev oluştur</h2><p className="mt-0.5 text-xs text-ink-soft">Görev bilgilerini, zamanını ve sorumlularını belirleyin.</p></div></div>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Kapat" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-canvas-border text-ink-soft hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"><CloseIcon /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-5 lg:px-6 lg:py-6">
            <div className="grid gap-4">
              <section className="rounded-xl border border-canvas-border bg-canvas p-4 sm:p-5">
                <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand-dark"><TaskIcon /></span><div><h3 className="text-sm font-semibold text-ink">Görev bilgileri</h3><p className="mt-0.5 text-xs text-ink-soft">Bağlı kayıt, görev adı ve açıklama.</p></div></div>
                <div className="mt-4 grid gap-4">
                  <label className="grid gap-1.5 text-sm font-medium text-ink">Bağlı kayıt<select value={contextSelection} onChange={(event) => onContextSelectionChange(event.target.value)} className={fieldClass}>{isSuperAdmin ? <option value="standalone">Bağımsız görev</option> : null}{events.length > 0 ? <optgroup label="Etkinlikler">{events.map((item) => <option key={item.id} value={contextKeyFor('event', item.id)}>{item.title}</option>)}</optgroup> : null}{awarenessPosts.length > 0 ? <optgroup label="Farkındalıklar">{awarenessPosts.map((item) => <option key={item.id} value={contextKeyFor('awareness', item.id)}>{item.title}</option>)}</optgroup> : null}</select></label>
                  <label className="grid gap-1.5 text-sm font-medium text-ink">Görev adı<input value={title} onChange={(event) => onTitleChange(event.target.value)} maxLength={200} placeholder="Görev adını yazın" className={fieldClass} /></label>
                  <label className="grid gap-1.5 text-sm font-medium text-ink"><span>Açıklama <span className="text-xs font-normal text-ink-soft">(isteğe bağlı)</span></span><textarea value={description} onChange={(event) => onDescriptionChange(event.target.value)} rows={4} placeholder="Görevin kapsamını açıklayın" className={`${fieldClass} resize-y`} /></label>
                  <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1.5 text-sm font-medium text-ink">Son tarih<input type="datetime-local" value={deadline} onChange={(event) => onDeadlineChange(event.target.value)} className={fieldClass} /></label><label className="grid gap-1.5 text-sm font-medium text-ink">Öncelik<select value={priority} onChange={(event) => onPriorityChange(event.target.value)} className={fieldClass}>{priorities.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label></div>
                </div>
              </section>

              <section className="rounded-xl border border-canvas-border bg-canvas p-4 sm:p-5">
                <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-amber-800"><PersonIcon /></span><div><h3 className="text-sm font-semibold text-ink">Sorumluluklar</h3><p className="mt-0.5 text-xs text-ink-soft">Görevde yer alacak ekip üyeleri.</p></div></div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm font-medium text-ink sm:col-span-2">Ana sorumlu<select value={primaryProfileId} onChange={(event) => onPrimaryProfileIdChange(event.target.value)} className={fieldClass}><option value="">Seçiniz</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
                  <label className="grid gap-1.5 text-sm font-medium text-ink">Destekleyen<select value={supportingProfileId} onChange={(event) => onSupportingProfileIdChange(event.target.value)} className={fieldClass}><option value="">Seçiniz</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
                  <label className="grid gap-1.5 text-sm font-medium text-ink">Bilgilendirilen<select value={informedProfileId} onChange={(event) => onInformedProfileIdChange(event.target.value)} className={fieldClass}><option value="">Seçiniz</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
                </div>
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">Aynı kişi bir görevde birden fazla sorumluluk türünde seçilemez.</p>
              </section>
            </div>

            {error ? <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          </div>

          <div className="shrink-0 border-t border-canvas-border bg-canvas-surface px-4 pt-3 lg:px-6 lg:py-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.875rem)' }}>
            <div className="flex items-center gap-3 lg:justify-end">
              <button type="button" onClick={onClose} className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-brand bg-canvas-surface px-4 text-sm font-semibold text-brand-dark hover:bg-brand-soft lg:flex-none">İptal</button>
              <button type="submit" disabled={saving || !contextSelection} className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-accent px-5 text-sm font-semibold text-white shadow-card hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 lg:flex-none">{saving ? 'Oluşturuluyor…' : 'Görevi oluştur'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
