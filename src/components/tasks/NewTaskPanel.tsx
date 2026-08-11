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
const fieldClass = 'min-h-[44px] rounded-md border border-canvas-border bg-canvas-surface px-3 py-2 font-normal text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand'

function CloseIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
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
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="new-task-title" className="absolute inset-0 flex flex-col bg-canvas-surface shadow-2xl lg:inset-y-0 lg:left-auto lg:right-0 lg:w-full lg:max-w-[540px]">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-canvas-border bg-canvas-surface px-4 pb-3 lg:px-6 lg:py-5" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}>
          <h2 id="new-task-title" className="text-base font-semibold text-brand-dark lg:text-lg">Yeni görev oluştur</h2>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Kapat" className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"><CloseIcon /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-5 lg:px-6 lg:py-6">
            <div className="grid gap-5">
              <label className="grid gap-1.5 text-sm font-medium text-ink">
                Bağlı kayıt
                <select value={contextSelection} onChange={(event) => onContextSelectionChange(event.target.value)} className={fieldClass}>
                  {isSuperAdmin ? <option value="standalone">Bağımsız görev</option> : null}
                  {events.length > 0 ? <optgroup label="Etkinlikler">{events.map((item) => <option key={item.id} value={contextKeyFor('event', item.id)}>{item.title}</option>)}</optgroup> : null}
                  {awarenessPosts.length > 0 ? <optgroup label="Farkındalıklar">{awarenessPosts.map((item) => <option key={item.id} value={contextKeyFor('awareness', item.id)}>{item.title}</option>)}</optgroup> : null}
                </select>
              </label>

              <label className="grid gap-1.5 text-sm font-medium text-ink">Görev adı<input value={title} onChange={(event) => onTitleChange(event.target.value)} maxLength={200} className={fieldClass} /></label>
              <label className="grid gap-1.5 text-sm font-medium text-ink">Açıklama<textarea value={description} onChange={(event) => onDescriptionChange(event.target.value)} rows={4} className={`${fieldClass} resize-y`} /></label>

              <div className="grid gap-5 lg:grid-cols-2 lg:gap-4">
                <label className="grid gap-1.5 text-sm font-medium text-ink">Son tarih<input type="datetime-local" value={deadline} onChange={(event) => onDeadlineChange(event.target.value)} className={fieldClass} /></label>
                <label className="grid gap-1.5 text-sm font-medium text-ink">Öncelik<select value={priority} onChange={(event) => onPriorityChange(event.target.value)} className={fieldClass}>{priorities.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
              </div>

              <div className="h-px bg-canvas-border" />
              <p className="-mb-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">Sorumluluklar</p>
              <label className="grid gap-1.5 text-sm font-medium text-ink">Ana sorumlu<select value={primaryProfileId} onChange={(event) => onPrimaryProfileIdChange(event.target.value)} className={fieldClass}><option value="">Seçiniz</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
              <label className="grid gap-1.5 text-sm font-medium text-ink">Destekleyen<select value={supportingProfileId} onChange={(event) => onSupportingProfileIdChange(event.target.value)} className={fieldClass}><option value="">Seçiniz</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
              <label className="grid gap-1.5 text-sm font-medium text-ink">Bilgilendirilen<select value={informedProfileId} onChange={(event) => onInformedProfileIdChange(event.target.value)} className={fieldClass}><option value="">Seçiniz</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
            </div>

            {error ? <p role="alert" className="mt-5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          </div>

          <div className="shrink-0 border-t border-canvas-border bg-canvas-surface px-4 pt-3 lg:px-6 lg:py-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.875rem)' }}>
            <div className="flex items-center gap-3 lg:justify-end">
              <button type="button" onClick={onClose} className="flex min-h-[44px] flex-1 items-center justify-center rounded-md border border-canvas-border bg-canvas-surface px-4 text-sm font-medium text-ink hover:bg-canvas lg:flex-none">İptal</button>
              <button type="submit" disabled={saving || !contextSelection} className="flex min-h-[44px] flex-1 items-center justify-center rounded-md bg-accent px-5 text-sm font-semibold text-white shadow-card hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 lg:flex-none">{saving ? 'Oluşturuluyor…' : 'Görevi oluştur'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
