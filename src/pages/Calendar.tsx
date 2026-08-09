import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useMembershipStatus } from '../hooks/useMembershipStatus'

type LoadState = 'loading' | 'ready' | 'error'
type FormMode = 'closed' | 'create' | 'edit'
type EntryType = 'academic' | 'official' | 'meeting' | 'other'

const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const ENTRY_TYPES: Array<{ value: EntryType; label: string }> = [
  { value: 'academic', label: 'Akademik' },
  { value: 'official', label: 'Resmî' },
  { value: 'meeting', label: 'Toplantı' },
  { value: 'other', label: 'Diğer' },
]

interface EventRow {
  id: string
  title: string
  planningDate: string | null
  preparationStartDate: string | null
  estimatedDate: string | null
  confirmedDate: string | null
}

interface AwarenessRow {
  id: string
  awarenessName: string
  startDate: string | null
  endDate: string | null
  estimatedDate: string | null
  shareDate: string | null
  preparationStartDate: string | null
  closingDate: string | null
}

interface ManualEntry {
  id: string
  title: string
  entryType: EntryType
  startDate: string
  endDate: string | null
  note: string | null
  deletedAt: string | null
}

interface TaskRow {
  id: string
  eventId: string
  eventTitle: string
  title: string
  deadlineAt: string
}

interface RpcTaskRow {
  id: string
  event_id: string
  event_title: string
  title: string
  deadline_at: string
}

interface CalendarItem {
  id: string
  label: string
  kind: 'event' | 'awareness' | 'manual' | 'task'
  linkTo?: string
}

function parseDateOnly(value: string | null): Date | null {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  if (![year, month, day].every(Number.isFinite)) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  return Number.isNaN(date.getTime()) ? null : date
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function dateKeysBetween(startValue: string, endValue: string): string[] {
  const start = parseDateOnly(startValue)
  const end = parseDateOnly(endValue)
  if (!start || !end || start > end) return []
  const result: string[] = []
  const cursor = new Date(start.getTime())
  let guard = 0
  while (cursor <= end && guard < 730) {
    result.push(dateKey(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
    guard += 1
  }
  return result
}

function formatDate(value: string | null): string {
  const date = parseDateOnly(value)
  if (!date) return 'Tarih belirtilmedi'
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month, 1)))
}

function CenteredMessage({ text }: { text: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <p className="text-center text-sm text-ink-soft">{text}</p>
    </div>
  )
}

export default function Calendar({ session }: { session: Session }) {
  const { hasActiveMembership, periodId, periodLabel, appRole, loading: statusLoading } = useMembershipStatus(session)
  const isSuperAdmin = appRole === 'super_admin'

  const [periodStartsOn, setPeriodStartsOn] = useState<string | null>(null)
  const [periodEndsOn, setPeriodEndsOn] = useState<string | null>(null)
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [events, setEvents] = useState<EventRow[]>([])
  const [awarenessPosts, setAwarenessPosts] = useState<AwarenessRow[]>([])
  const [manualEntries, setManualEntries] = useState<ManualEntry[]>([])
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [showInactive, setShowInactive] = useState(false)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [formMode, setFormMode] = useState<FormMode>('closed')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [entryType, setEntryType] = useState<EntryType>('other')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!periodId) return
    let mounted = true
    async function loadPeriod() {
      const result = await supabase.from('periods').select('starts_on, ends_on').eq('id', periodId).maybeSingle()
      if (!mounted || result.error || !result.data) return
      setPeriodStartsOn((result.data.starts_on as string | null) ?? null)
      setPeriodEndsOn((result.data.ends_on as string | null) ?? null)
    }
    void loadPeriod()
    return () => {
      mounted = false
    }
  }, [periodId])

  useEffect(() => {
    if (!periodId) return
    const today = new Date()
    const todayKey = dateKey(new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())))
    const start = periodStartsOn ?? todayKey
    const end = periodEndsOn ?? todayKey
    const initialKey = todayKey < start ? start : todayKey > end ? end : todayKey
    const initialDate = parseDateOnly(initialKey)
    if (!initialDate) return
    setViewYear(initialDate.getUTCFullYear())
    setViewMonth(initialDate.getUTCMonth())
  }, [periodId, periodStartsOn, periodEndsOn])

  useEffect(() => {
    if (statusLoading) return
    if (!hasActiveMembership || !periodId) {
      setLoadState('ready')
      return
    }

    let mounted = true
    async function loadCalendarData() {
      setLoadState('loading')
      setLoadError(null)

      let manualQuery = supabase
        .from('calendar_entries')
        .select('id, title, entry_type, start_date, end_date, note, deleted_at')
        .eq('period_id', periodId)
        .order('start_date', { ascending: true })
      if (!showInactive || !isSuperAdmin) manualQuery = manualQuery.is('deleted_at', null)

      const [eventResult, awarenessResult, manualResult, taskResult] = await Promise.all([
        supabase
          .from('events')
          .select('id, title, planning_date, preparation_start_date, estimated_date, confirmed_date')
          .eq('period_id', periodId)
          .is('deleted_at', null),
        supabase
          .from('awareness_posts')
          .select('id, awareness_name, start_date, end_date, estimated_date, share_date, preparation_start_date, closing_date')
          .eq('period_id', periodId)
          .is('deleted_at', null),
        manualQuery,
        supabase.rpc('get_my_calendar_task_deadlines', { target_period_id: periodId }),
      ])

      if (!mounted) return
      if (eventResult.error || awarenessResult.error || manualResult.error || taskResult.error) {
        setLoadState('error')
        setLoadError('Takvim verileri yüklenirken bir hata oluştu.')
        return
      }

      setEvents((eventResult.data ?? []).map((row) => ({
        id: row.id as string,
        title: row.title as string,
        planningDate: (row.planning_date as string | null) ?? null,
        preparationStartDate: (row.preparation_start_date as string | null) ?? null,
        estimatedDate: (row.estimated_date as string | null) ?? null,
        confirmedDate: (row.confirmed_date as string | null) ?? null,
      })))
      setAwarenessPosts((awarenessResult.data ?? []).map((row) => ({
        id: row.id as string,
        awarenessName: row.awareness_name as string,
        startDate: (row.start_date as string | null) ?? null,
        endDate: (row.end_date as string | null) ?? null,
        estimatedDate: (row.estimated_date as string | null) ?? null,
        shareDate: (row.share_date as string | null) ?? null,
        preparationStartDate: (row.preparation_start_date as string | null) ?? null,
        closingDate: (row.closing_date as string | null) ?? null,
      })))
      setManualEntries((manualResult.data ?? []).map((row) => ({
        id: row.id as string,
        title: row.title as string,
        entryType: row.entry_type as EntryType,
        startDate: row.start_date as string,
        endDate: (row.end_date as string | null) ?? null,
        note: (row.note as string | null) ?? null,
        deletedAt: (row.deleted_at as string | null) ?? null,
      })))
      setTasks(((taskResult.data ?? []) as RpcTaskRow[]).map((row) => ({
        id: row.id as string,
        eventId: row.event_id as string,
        eventTitle: row.event_title as string,
        title: row.title as string,
        deadlineAt: row.deadline_at as string,
      })))
      setLoadState('ready')
    }
    void loadCalendarData()
    return () => {
      mounted = false
    }
  }, [hasActiveMembership, isSuperAdmin, periodId, reloadKey, showInactive, statusLoading])

  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>()
    function add(key: string | null, item: CalendarItem) {
      if (!key) return
      const items = map.get(key) ?? []
      items.push(item)
      map.set(key, items)
    }

    for (const event of events) {
      add(event.planningDate, { id: `${event.id}-planning`, label: `${event.title} · Planlama`, kind: 'event', linkTo: `/app/etkinlikler/${event.id}` })
      add(event.preparationStartDate, { id: `${event.id}-preparation`, label: `${event.title} · Hazırlık başlangıcı`, kind: 'event', linkTo: `/app/etkinlikler/${event.id}` })
      add(event.estimatedDate, { id: `${event.id}-estimated`, label: `${event.title} · Tahmini tarih`, kind: 'event', linkTo: `/app/etkinlikler/${event.id}` })
      add(event.confirmedDate, { id: `${event.id}-confirmed`, label: `${event.title} · Kesinleşmiş tarih`, kind: 'event', linkTo: `/app/etkinlikler/${event.id}` })
    }

    for (const post of awarenessPosts) {
      if (post.startDate) {
        const end = post.endDate ?? post.startDate
        for (const key of dateKeysBetween(post.startDate, end)) {
          add(key, { id: `${post.id}-range-${key}`, label: `${post.awarenessName} · Farkındalık dönemi`, kind: 'awareness', linkTo: '/app/farkindalik' })
        }
      }
      add(post.preparationStartDate, { id: `${post.id}-preparation`, label: `${post.awarenessName} · Hazırlık başlangıcı`, kind: 'awareness', linkTo: '/app/farkindalik' })
      add(post.estimatedDate, { id: `${post.id}-estimated`, label: `${post.awarenessName} · Tahmini paylaşım`, kind: 'awareness', linkTo: '/app/farkindalik' })
      add(post.shareDate, { id: `${post.id}-share`, label: `${post.awarenessName} · Paylaşım`, kind: 'awareness', linkTo: '/app/farkindalik' })
      add(post.closingDate, { id: `${post.id}-closing`, label: `${post.awarenessName} · Kapanış`, kind: 'awareness', linkTo: '/app/farkindalik' })
    }

    for (const entry of manualEntries) {
      const end = entry.endDate ?? entry.startDate
      for (const key of dateKeysBetween(entry.startDate, end)) {
        add(key, { id: `${entry.id}-${key}`, label: `${entry.title} · ${entry.entryType}`, kind: 'manual' })
      }
    }

    for (const task of tasks) {
      const date = new Date(task.deadlineAt)
      if (Number.isNaN(date.getTime())) continue
      const key = dateKey(new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())))
      add(key, { id: task.id, label: `${task.title} · Görev son tarihi`, kind: 'task', linkTo: `/app/etkinlikler/${task.eventId}` })
    }

    return map
  }, [awarenessPosts, events, manualEntries, tasks])

  const calendarCells = useMemo(() => {
    const first = new Date(Date.UTC(viewYear, viewMonth, 1))
    const firstWeekday = (first.getUTCDay() + 6) % 7
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate()
    const cells: Array<string | null> = Array.from({ length: firstWeekday }, () => null)
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(dateKey(new Date(Date.UTC(viewYear, viewMonth, day))))
    }
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [viewMonth, viewYear])

  const selectedItems = selectedDate ? itemsByDate.get(selectedDate) ?? [] : []

  function changeMonth(amount: number) {
    const next = new Date(Date.UTC(viewYear, viewMonth + amount, 1))
    setViewYear(next.getUTCFullYear())
    setViewMonth(next.getUTCMonth())
    setSelectedDate(null)
  }

  function resetForm() {
    setEditingId(null)
    setTitle('')
    setEntryType('other')
    setStartDate('')
    setEndDate('')
    setNote('')
    setFormError(null)
  }

  function openCreate() {
    resetForm()
    setFormMode('create')
    setActionMessage(null)
  }

  function openEdit(entry: ManualEntry) {
    setEditingId(entry.id)
    setTitle(entry.title)
    setEntryType(entry.entryType)
    setStartDate(entry.startDate)
    setEndDate(entry.endDate ?? '')
    setNote(entry.note ?? '')
    setFormError(null)
    setActionMessage(null)
    setFormMode('edit')
  }

  async function saveEntry() {
    if (!isSuperAdmin || !periodId) return
    setFormError(null)
    if (!title.trim()) {
      setFormError('Takvim başlığı zorunludur.')
      return
    }
    if (!startDate) {
      setFormError('Başlangıç tarihi zorunludur.')
      return
    }
    if (endDate && endDate < startDate) {
      setFormError('Bitiş tarihi başlangıç tarihinden önce olamaz.')
      return
    }

    setSaving(true)
    const payload = {
      title: title.trim(),
      entry_type: entryType,
      start_date: startDate,
      end_date: endDate || null,
      note: note.trim() || null,
    }
    const result = formMode === 'create'
      ? await supabase.from('calendar_entries').insert({ period_id: periodId, created_by: session.user.id, ...payload })
      : await supabase.from('calendar_entries').update(payload).eq('id', editingId)
    setSaving(false)
    if (result.error) {
      setFormError(result.error.message.toLowerCase().includes('kilit')
        ? 'Dönem kilitli olduğu için kayıt değiştirilemedi.'
        : 'Takvim kaydı kaydedilemedi.')
      return
    }
    setFormMode('closed')
    setActionMessage(formMode === 'create' ? 'Takvim kaydı eklendi.' : 'Takvim kaydı güncellendi.')
    setReloadKey((value) => value + 1)
  }

  async function toggleEntry(entry: ManualEntry) {
    if (!isSuperAdmin) return
    const deactivate = !entry.deletedAt
    if (deactivate && !window.confirm('Bu takvim kaydını pasifleştirmek istiyor musunuz?')) return
    const result = await supabase
      .from('calendar_entries')
      .update(deactivate
        ? { deleted_at: new Date().toISOString(), deleted_by: session.user.id, deletion_note: 'Takvim kaydı pasifleştirildi' }
        : { deleted_at: null, deleted_by: null, deletion_note: null })
      .eq('id', entry.id)
    if (result.error) {
      setActionMessage(result.error.message.toLowerCase().includes('kilit') ? 'Dönem kilitli olduğu için işlem yapılamadı.' : 'Takvim kaydı güncellenemedi.')
      return
    }
    setActionMessage(deactivate ? 'Takvim kaydı pasifleştirildi.' : 'Takvim kaydı yeniden aktifleştirildi.')
    setReloadKey((value) => value + 1)
  }

  if (statusLoading || loadState === 'loading') return <CenteredMessage text="Takvim yükleniyor…" />
  if (!hasActiveMembership || !periodId) return <CenteredMessage text="Aktif dönem üyeliğiniz bulunmuyor." />
  if (loadState === 'error') return <CenteredMessage text={loadError ?? 'Takvim yüklenemedi.'} />

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="border-b border-canvas-border bg-canvas-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/app" className="text-sm font-semibold">MUPSA Ekip Koordinasyon</Link>
          <Link to="/app" className="text-sm text-ink-soft hover:text-ink">Ana sayfaya dön</Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-ink-soft">Aktif dönem: {periodLabel ?? 'Belirtilmedi'}</p>
            <h1 className="mt-1 text-2xl font-semibold">Takvim</h1>
          </div>
          {isSuperAdmin && (
            <div className="flex flex-wrap items-center gap-3 text-sm text-ink-soft">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />
                Pasif kayıtları göster
              </label>
              <button type="button" onClick={openCreate} className="rounded-md border border-canvas-border bg-canvas-surface px-3 py-2 font-medium text-ink hover:border-ink/30">
                Manuel kayıt ekle
              </button>
            </div>
          )}
        </div>

        {actionMessage && <p className="mb-4 rounded-md border border-canvas-border bg-canvas-surface px-3 py-2 text-sm text-ink-soft">{actionMessage}</p>}

        {formMode !== 'closed' && (
          <section className="mb-5 rounded-lg border border-canvas-border bg-canvas-surface p-4 shadow-card">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-semibold">{formMode === 'create' ? 'Yeni manuel takvim kaydı' : 'Takvim kaydını düzenle'}</h2>
              <button type="button" onClick={() => setFormMode('closed')} className="text-sm text-ink-soft hover:text-ink">Kapat</button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium">Başlık
                <input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 w-full rounded-md border border-canvas-border bg-canvas px-3 py-2 font-normal" />
              </label>
              <label className="text-sm font-medium">Kategori
                <select value={entryType} onChange={(event) => setEntryType(event.target.value as EntryType)} className="mt-1 w-full rounded-md border border-canvas-border bg-canvas px-3 py-2 font-normal">
                  {ENTRY_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium">Başlangıç tarihi
                <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1 w-full rounded-md border border-canvas-border bg-canvas px-3 py-2 font-normal" />
              </label>
              <label className="text-sm font-medium">Bitiş tarihi <span className="font-normal text-ink-soft">(isteğe bağlı)</span>
                <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1 w-full rounded-md border border-canvas-border bg-canvas px-3 py-2 font-normal" />
              </label>
              <label className="text-sm font-medium sm:col-span-2">Not <span className="font-normal text-ink-soft">(isteğe bağlı)</span>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="mt-1 w-full rounded-md border border-canvas-border bg-canvas px-3 py-2 font-normal" />
              </label>
            </div>
            {formError && <p className="mt-3 text-sm text-red-700">{formError}</p>}
            <button type="button" disabled={saving} onClick={() => void saveEntry()} className="mt-4 rounded-md bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </section>
        )}

        <section className="rounded-lg border border-canvas-border bg-canvas-surface p-3 shadow-card sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <button type="button" onClick={() => changeMonth(-1)} className="rounded-md border border-canvas-border px-3 py-2 text-sm text-ink-soft hover:text-ink">Önceki ay</button>
            <h2 className="text-lg font-semibold capitalize">{monthLabel(viewYear, viewMonth)}</h2>
            <button type="button" onClick={() => changeMonth(1)} className="rounded-md border border-canvas-border px-3 py-2 text-sm text-ink-soft hover:text-ink">Sonraki ay</button>
          </div>

          <div className="grid grid-cols-7 border-l border-t border-canvas-border">
            {WEEKDAYS.map((weekday) => <div key={weekday} className="border-b border-r border-canvas-border px-1 py-2 text-center text-xs font-semibold text-ink-soft sm:px-2">{weekday}</div>)}
            {calendarCells.map((key, index) => {
              const items = key ? itemsByDate.get(key) ?? [] : []
              const isSelected = key === selectedDate
              return (
                <button key={key ?? `empty-${index}`} type="button" disabled={!key} onClick={() => key && setSelectedDate(key)} className={`min-h-20 border-b border-r border-canvas-border p-1 text-left align-top sm:min-h-24 sm:p-2 ${isSelected ? 'bg-canvas' : 'bg-canvas-surface'} ${key ? 'hover:bg-canvas' : 'cursor-default'}`}>
                  {key && <>
                    <span className="text-xs font-semibold text-ink-soft">{Number(key.slice(-2))}</span>
                    {items.length > 0 && <span className="mt-2 block text-xs text-ink">{items.length} kayıt</span>}
                  </>}
                </button>
              )
            })}
          </div>
        </section>

        {selectedDate && (
          <section className="mt-5 rounded-lg border border-canvas-border bg-canvas-surface p-4 shadow-card">
            <h2 className="mb-3 font-semibold">{formatDate(selectedDate)}</h2>
            {selectedItems.length === 0 ? <p className="text-sm italic text-ink-soft">Bu gün için kayıt bulunmuyor.</p> : <ul className="space-y-2">
              {selectedItems.map((item) => {
                const content = <span className="block break-words rounded-md border border-canvas-border bg-canvas p-3 text-sm">{item.label}</span>
                return <li key={item.id}>{item.linkTo ? <Link to={item.linkTo} className="block hover:opacity-80">{content}</Link> : content}</li>
              })}
            </ul>}
          </section>
        )}

        {isSuperAdmin && showInactive && manualEntries.some((entry) => entry.deletedAt) && (
          <section className="mt-5 rounded-lg border border-canvas-border bg-canvas-surface p-4 shadow-card">
            <h2 className="mb-3 font-semibold">Pasif manuel kayıtlar</h2>
            <ul className="space-y-2">
              {manualEntries.filter((entry) => entry.deletedAt).map((entry) => <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-canvas-border bg-canvas p-3 text-sm"><span>{entry.title} · {formatDate(entry.startDate)}</span><button type="button" onClick={() => void toggleEntry(entry)} className="text-sm font-medium text-ink hover:underline">Yeniden aktifleştir</button></li>)}
            </ul>
          </section>
        )}

        {isSuperAdmin && manualEntries.some((entry) => !entry.deletedAt) && (
          <section className="mt-5 rounded-lg border border-canvas-border bg-canvas-surface p-4 shadow-card">
            <h2 className="mb-3 font-semibold">Manuel kayıtlar</h2>
            <ul className="space-y-2">
              {manualEntries.filter((entry) => !entry.deletedAt).map((entry) => <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-canvas-border bg-canvas p-3 text-sm"><span className="break-words">{entry.title} · {formatDate(entry.startDate)}{entry.endDate ? ` – ${formatDate(entry.endDate)}` : ''}</span><span className="flex gap-3"><button type="button" onClick={() => openEdit(entry)} className="text-sm font-medium text-ink hover:underline">Düzenle</button><button type="button" onClick={() => void toggleEntry(entry)} className="text-sm font-medium text-red-700 hover:underline">Pasifleştir</button></span></li>)}
            </ul>
          </section>
        )}
      </main>
    </div>
  )
}
