import { useEffect, useRef, useState } from 'react'

interface PermanentDeleteDialogProps {
  isOpen: boolean
  title: string
  itemName: string
  description: string
  isDeleting: boolean
  error?: string | null
  onClose: () => void
  onConfirm: () => void
}

export default function PermanentDeleteDialog({
  isOpen,
  title,
  itemName,
  description,
  isDeleting,
  error,
  onClose,
  onConfirm,
}: PermanentDeleteDialogProps) {
  const [confirmation, setConfirmation] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) {
      setConfirmation('')
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.setTimeout(() => inputRef.current?.focus(), 0)

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isDeleting) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isDeleting, isOpen, onClose])

  if (!isOpen) return null

  const normalizedConfirmation = confirmation.trim().normalize('NFC')
  const normalizedItemName = itemName.trim().normalize('NFC')
  const confirmed = normalizedConfirmation === normalizedItemName

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/50 p-0 backdrop-blur-[1px] sm:items-center sm:p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="permanent-delete-title" className="w-full max-w-lg overflow-hidden rounded-t-2xl border border-canvas-border bg-canvas-surface shadow-2xl sm:rounded-2xl">
        <div className="flex items-start gap-3 border-b border-canvas-border px-4 py-4 sm:px-6">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" /></svg>
          </span>
          <div>
            <h2 id="permanent-delete-title" className="text-lg font-semibold text-ink">{title}</h2>
            <p className="mt-1 text-sm leading-5 text-ink-soft">{description}</p>
          </div>
        </div>

        <div className="px-4 py-5 sm:px-6">
          <div className="rounded-xl border border-danger/20 bg-danger-soft/60 p-3.5 text-sm leading-6 text-danger">
            Bu işlem geri alınamaz. Onaylamak için aşağıya <strong className="break-all">{itemName}</strong> yazın.
          </div>

          <label className="mt-4 grid gap-2 text-sm font-medium text-ink">
            Kayıt adı
            <input ref={inputRef} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={isDeleting} autoComplete="off" className="min-h-[48px] rounded-lg border border-canvas-border bg-canvas px-3 text-ink outline-none transition focus:border-danger focus:ring-2 focus:ring-danger/15 disabled:opacity-60" />
          </label>

          {error ? <p role="alert" className="mt-3 rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p> : null}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-canvas-border bg-canvas px-4 py-3 sm:flex-row sm:justify-end sm:px-6" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
          <button type="button" onClick={onClose} disabled={isDeleting} className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-canvas-border px-4 text-sm font-semibold text-ink disabled:opacity-60 sm:w-auto">İptal</button>
          <button type="button" onClick={onConfirm} disabled={!confirmed || isDeleting} className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-danger px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto">{isDeleting ? 'Siliniyor…' : 'Kalıcı olarak sil'}</button>
        </div>
      </section>
    </div>
  )
}
