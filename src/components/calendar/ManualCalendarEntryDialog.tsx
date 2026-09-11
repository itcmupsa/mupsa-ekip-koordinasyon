import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabaseClient'
import { useMembershipStatus } from '../../hooks/useMembershipStatus'
import { dateKeyInIstanbul, isHexColor } from '../../lib/prCalendar'

export type CalendarScope = 'events' | 'awareness' | 'pr'
export interface ManualCalendarRecord {
  id: string; period_id: string; title: string; entry_type: string;
  start_date: string; end_date: string | null; note: string | null;
  calendar_scopes: CalendarScope[]; color: string; deleted_at: string | null;
}
const scopes: Array<{ value: CalendarScope; label: string }> = [
  { value: 'events', label: 'Etkinlik Takvimi' }, { value: 'awareness', label: 'Farkındalık Takvimi' }, { value: 'pr', label: 'PR Takvimi' },
]
const fieldClass = 'mt-1 block min-h-11 w-full rounded-lg border border-canvas-border bg-white px-3 py-2 text-sm text-ink'

export default function ManualCalendarEntryDialog({ session, scope, entry, onClose, onSaved }: {
  session: Session; scope: CalendarScope; entry: ManualCalendarRecord | null; onClose: () => void; onSaved: () => void;
}) {
  const { periodId, appRole, loading } = useMembershipStatus(session)
  const canManage = appRole === 'super_admin'
  const [draft, setDraft] = useState(() => ({ title: entry?.title ?? '', entry_type: entry?.entry_type ?? 'other', start_date: entry?.start_date ?? dateKeyInIstanbul(), end_date: entry?.end_date ?? '', note: entry?.note ?? '', color: entry?.color ?? '#7c3aed', calendar_scopes: entry?.calendar_scopes ?? [scope] }))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLElement>(null)
  const savedFocus = useRef<HTMLElement | null>(null)
  const busy = useRef(false)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    savedFocus.current = document.activeElement as HTMLElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current?.querySelector<HTMLElement>('button')?.focus()
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy.current) closeRef.current()
      if (e.key !== 'Tab') return
      const fields = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])') ?? [])
      if (!fields.length) return
      if (e.shiftKey && (document.activeElement === fields[0] || !ref.current?.contains(document.activeElement))) { e.preventDefault(); fields.at(-1)?.focus() }
      else if (!e.shiftKey && document.activeElement === fields.at(-1)) { e.preventDefault(); fields[0]?.focus() }
    }
    document.addEventListener('keydown', key)
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', key); savedFocus.current?.focus() }
  }, [])
  async function save(deactivate = false) {
    if (!canManage || !periodId || busy.current) return
    if (!draft.title.trim() || !draft.start_date || !draft.calendar_scopes.length) { setError('Başlık, tarih ve en az bir takvim seçimi gerekli.'); return }
    if (draft.end_date && draft.end_date < draft.start_date) { setError('Bitiş tarihi başlangıçtan önce olamaz.'); return }
    if (!isHexColor(draft.color)) { setError('Geçerli bir renk seçin.'); return }
    busy.current = true; setSaving(true); setError(null)
    try {
      const payload = { ...draft, title: draft.title.trim(), end_date: draft.end_date || null, note: draft.note.trim() || null }
      const result = entry
        ? await supabase.from('calendar_entries').update(deactivate ? { deleted_at: entry.deleted_at ? null : new Date().toISOString(), deleted_by: entry.deleted_at ? null : session.user.id } : payload).eq('id', entry.id).eq('period_id', periodId).select('id').single()
        : await supabase.from('calendar_entries').insert({ ...payload, period_id: periodId, created_by: session.user.id }).select('id').single()
      if (result.error) throw result.error
      onSaved()
    } catch (err) { setError(err instanceof Error ? err.message : 'Kayıt kaydedilemedi. Yetkinizi ve bağlantınızı kontrol edin.') }
    finally { busy.current = false; setSaving(false) }
  }
  return <div className="fixed inset-0 z-[60] flex justify-end bg-ink/40 sm:p-4" onMouseDown={e => { if (e.target === e.currentTarget && !saving) onClose() }}>
    <section ref={ref} role="dialog" aria-modal="true" aria-labelledby="manual-title" className="flex h-[100dvh] w-full max-w-xl flex-col bg-white shadow-2xl sm:h-full sm:rounded-2xl">
      <header className="flex items-center justify-between border-b border-canvas-border p-5"><h2 id="manual-title" className="text-xl font-semibold">{entry ? 'Manuel kayıt' : 'Manuel kayıt ekle'}</h2><button type="button" onClick={onClose} disabled={saving} aria-label="Manuel kayıt panelini kapat" className="h-11 w-11 rounded-lg border">✕</button></header>
      <form onSubmit={e => { e.preventDefault(); void save() }} className="flex-1 space-y-4 overflow-y-auto p-5">
        <fieldset disabled={!canManage || loading || saving} className="space-y-4 disabled:opacity-80">
          <label className="block text-sm font-medium">Başlık<input required value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} className={fieldClass} /></label>
          <label className="block text-sm font-medium">Kategori<select value={draft.entry_type} onChange={e => setDraft({ ...draft, entry_type: e.target.value })} className={fieldClass}><option value="academic">Akademik</option><option value="official">Resmî</option><option value="meeting">Toplantı</option><option value="other">Diğer</option></select></label>
          <div className="grid grid-cols-2 gap-3"><label className="text-sm font-medium">Başlangıç<input type="date" required value={draft.start_date} onChange={e => setDraft({ ...draft, start_date: e.target.value })} className={fieldClass} /></label><label className="text-sm font-medium">Bitiş (isteğe bağlı)<input type="date" min={draft.start_date} value={draft.end_date} onChange={e => setDraft({ ...draft, end_date: e.target.value })} className={fieldClass} /></label></div>
          <fieldset className="rounded-lg border border-canvas-border p-3"><legend className="px-1 text-sm font-medium">Görüneceği takvimler</legend>{scopes.map(item => <label key={item.value} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={draft.calendar_scopes.includes(item.value)} onChange={e => setDraft({ ...draft, calendar_scopes: e.target.checked ? [...draft.calendar_scopes, item.value] : draft.calendar_scopes.filter(v => v !== item.value) })} />{item.label}</label>)}</fieldset>
          <label className="flex items-center gap-3 text-sm font-medium">Kayıt rengi<input type="color" value={draft.color} onChange={e => setDraft({ ...draft, color: e.target.value })} className="h-11 w-16" /></label>
          <label className="block text-sm font-medium">Not<textarea value={draft.note} onChange={e => setDraft({ ...draft, note: e.target.value })} rows={4} className={fieldClass} /></label>
        </fieldset>
        {error ? <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{error}</p> : null}
        {canManage ? <div className="flex justify-between gap-3 pb-6">{entry ? <button type="button" disabled={saving} onClick={() => void save(true)} className="min-h-11 rounded-lg border px-4 text-sm text-danger">{entry.deleted_at ? 'Yeniden aktifleştir' : 'Pasifleştir'}</button> : <span />}<button type="submit" disabled={saving} className="min-h-11 rounded-lg bg-brand-dark px-5 text-sm font-semibold text-white">{saving ? 'Kaydediliyor…' : 'Kaydet'}</button></div> : null}
      </form>
    </section>
  </div>
}
