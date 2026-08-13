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

  const confirmed = confirmation === itemName

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/50 p-0 backdrop-blur-[1px] sm:items-center sm:p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="permanent-delete-title" className="w-full max-w-lg rounded-t-2xl bg-canvas-surface p-5 shadow-2xl sm:rounded-2xl sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" /></svg>
          </span>
          <div>
            <h2 id="permanent-delete-title" className="text-lg font-semibold text-ink">{title}</h2>
            <p className="mt-1 text-sm leading-5 text-ink-soft">{description}</p>
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-danger/20 bg-danger-soft/60 p-3 text-sm text-danger">
          Bu işlem geri alınamaz. Onaylamak için aşağıya <strong className="break-all">{itemName}</strong> yazın.
        </div>

        <label className="mt-4 grid gap-2 text-sm font-medium text-ink">
          Kayıt adı
          <input ref={inputRef} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={isDeleting} autoComplete="off" className="min-h-[48px] rounded-lg border border-canvas-border bg-canvas px-3 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger" />
        </label>

        {error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-2" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <button type="button" onClick={onClose} disabled={isDeleting} className="min-h-[44px] rounded-lg border border-canvas-border px-4 text-sm font-medium text-ink disabled:opacity-60">İptal</button>
          <button type="button" onClick={onConfirm} disabled={!confirmed || isDeleting} className="min-h-[44px] rounded-lg bg-danger px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{isDeleting ? 'Siliniyor…' : 'Kalıcı olarak sil'}</button>
        </div>
      </section>
    </div>
  )
}
