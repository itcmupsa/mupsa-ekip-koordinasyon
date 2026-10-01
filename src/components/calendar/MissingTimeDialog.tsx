import { useEffect, useRef } from 'react'

export default function MissingTimeDialog({ onAddTime, onSaveWithoutTime }: { onAddTime: () => void; onSaveWithoutTime: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])
  return <dialog ref={ref} aria-labelledby="missing-time-title" aria-describedby="missing-time-message" onCancel={event => { event.preventDefault(); onAddTime() }} className="w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-canvas-border bg-canvas-surface p-5 text-ink shadow-2xl backdrop:bg-ink/50">
    <h2 id="missing-time-title" className="text-lg font-semibold">Yayın saati seçilmedi</h2>
    <p id="missing-time-message" className="mt-3 text-sm text-ink-soft">Saat girilmezse yayın hatırlatması gönderilmez.</p>
    <div className="mt-5 flex flex-wrap gap-3"><button type="button" autoFocus onClick={onAddTime} className="min-h-11 rounded-lg bg-brand-dark px-4 text-sm font-semibold text-white">Saat ekle</button><button type="button" onClick={onSaveWithoutTime} className="min-h-11 rounded-lg border border-canvas-border px-4 text-sm font-medium">Saat olmadan kaydet</button></div>
  </dialog>
}
