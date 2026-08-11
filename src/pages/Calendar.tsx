import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
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

const ITEM_STYLES: Record<CalendarItem['kind'], { dot: string; badge: string; label: string }> = {
  event: { dot: 'bg-brand-dark', badge: 'border-brand-dark/20 bg-brand-soft text-brand-dark', label: 'Etkinlik' },
  awareness: { dot: 'bg-accent', badge: 'border-accent/20 bg-accent-soft text-amber-800', label: 'Farkındalık' },
  task: { dot: 'bg-sky-600', badge: 'border-sky-200 bg-sky-50 text-sky-700', label: 'Görev' },
  manual: { dot: 'bg-purple-600', badge: 'border-purple-200 bg-purple-50 text-purple-700', label: 'Manuel kayıt' },
}

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
  eventId: string | null
  eventTitle: string
  title: string
  deadlineAt: string
}

interface RpcTaskRow {
  id: string
  event_id: string | null
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

interface CalendarCell {
  key: string
  isCurrentMonth: boolean
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

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <path d={direction === 'left' ? 'm15 5-7 7 7 7' : 'm9 5 7 7-7 7'} />
    </svg>
  )
}

function PlusIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
}

export default function Calendar({ session }: { session: Session }) {
  const { displayName, hasActiveMembership, periodId, periodLabel, appRole, coordinatorRoleName, loading: statusLoading } = useMembershipStatus(session)
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
    setSelectedDate(initialKey)
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
        eventId: (row.event_id as string | null) ?? null,
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
      add(key, { id: task.id, label: `${task.title} · Görev son tarihi`, kind: 'task', linkTo: task.eventId ? `/app/etkinlikler/${task.eventId}` : '/app/gorevler' })
    }

    return map
  }, [awarenessPosts, events, manualEntries, tasks])

  const calendarCells = useMemo(() => {
    const first = new Date(Date.UTC(viewYear, viewMonth, 1))
    const firstWeekday = (first.getUTCDay() + 6) % 7
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate()
    const cells: CalendarCell[] = []
    for (let offset = firstWeekday; offset > 0; offset -= 1) {
      const date = new Date(Date.UTC(viewYear, viewMonth, 1 - offset))
      cells.push({ key: dateKey(date), isCurrentMonth: false })
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({
        key: dateKey(new Date(Date.UTC(viewYear, viewMonth, day))),
        isCurrentMonth: true,
      })
    }
    const cellCount = cells.length <= 35 ? 35 : 42
    for (let offset = 1; cells.length < cellCount; offset += 1) {
      const date = new Date(Date.UTC(viewYear, viewMonth + 1, offset))
      cells.push({ key: dateKey(date), isCurrentMonth: false })
    }
    return cells
  }, [viewMonth, viewYear])

  const selectedItems = selectedDate ? itemsByDate.get(selectedDate) ?? [] : []

  function changeMonth(amount: number) {
    const next = new Date(Date.UTC(viewYear, viewMonth + amount, 1))
    setViewYear(next.getUTCFullYear())
    setViewMonth(next.getUTCMonth())
    setSelectedDate(dateKey(next))
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

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  if (statusLoading || loadState === 'loading') return <CenteredMessage text="Takvim yükleniyor…" />
  if (!hasActiveMembership || !periodId) return <CenteredMessage text="Aktif dönem üyeliğiniz bulunmuyor." />
  if (loadState === 'error') return <CenteredMessage text={loadError ?? 'Takvim yüklenemedi.'} />

  const roleLabel = coordinatorRoleName ?? (isSuperAdmin ? 'Süper Yönetici' : 'Koordinatör')
  const now = new Date()
  const todayKey = dateKey(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())))

  return (
    <AppShell
      isSuperAdmin={isSuperAdmin}
      displayName={displayName}
      roleLabel={roleLabel}
      onSignOut={() => void handleSignOut()}
    >
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="grid gap-4 lg:flex lg:items-end lg:justify-between">
          <div>
            <p className="text-sm text-ink-soft">
              Aktif dönem: <span className="font-medium text-brand-dark">{periodLabel ?? 'Belirtilmedi'}</span>
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink">Takvim</h1>
            <p className="mt-1 text-sm text-ink-soft">Etkinlikleri, farkındalık çalışmalarını ve görev tarihlerini birlikte görüntüle.</p>
          </div>

          {isSuperAdmin ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="flex min-h-[44px] items-center gap-2 rounded-md border border-canvas-border bg-canvas-surface px-3 text-sm text-ink-soft">
                <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} className="h-4 w-4 accent-brand" />
                Pasif kayıtları göster
              </label>
              <button
                type="button"
                onClick={openCreate}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-white shadow-card hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                <PlusIcon />
                Manuel kayıt ekle
              </button>
            </div>
          ) : null}
        </div>

        {actionMessage ? (
          <p role="status" className="mt-5 rounded-md border border-canvas-border bg-canvas-surface px-3 py-2 text-sm text-ink-soft">{actionMessage}</p>
        ) : null}

        {formMode !== 'closed' ? (
          <section className="mt-5 rounded-xl border border-canvas-border bg-canvas-surface p-4 shadow-card sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-ink">{formMode === 'create' ? 'Yeni manuel takvim kaydı' : 'Takvim kaydını düzenle'}</h2>
              <button type="button" onClick={() => setFormMode('closed')} className="min-h-[44px] rounded-md px-2 text-sm font-medium text-ink-soft hover:bg-canvas hover:text-ink">Kapat</button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium text-ink">Başlık
                <input value={title} onChange={(event) => setTitle(event.target.value)} disabled={saving} className="min-h-[44px] rounded-md border border-canvas-border bg-canvas-surface px-3 py-2 font-normal" />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-ink">Kategori
                <select value={entryType} onChange={(event) => setEntryType(event.target.value as EntryType)} disabled={saving} className="min-h-[44px] rounded-md border border-canvas-border bg-canvas-surface px-3 py-2 font-normal">
                  {ENTRY_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-ink">Başlangıç tarihi
                <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} disabled={saving} className="min-h-[44px] rounded-md border border-canvas-border bg-canvas-surface px-3 py-2 font-normal" />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-ink">Bitiş tarihi <span className="sr-only">isteğe bağlı</span>
                <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} disabled={saving} className="min-h-[44px] rounded-md border border-canvas-border bg-canvas-surface px-3 py-2 font-normal" />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-ink sm:col-span-2">Not <span className="sr-only">isteğe bağlı</span>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} disabled={saving} className="rounded-md border border-canvas-border bg-canvas-surface px-3 py-2 font-normal" />
              </label>
            </div>
            {formError ? <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p> : null}
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button type="button" disabled={saving} onClick={() => void saveEntry()} className="min-h-[44px] rounded-md bg-brand-dark px-5 text-sm font-medium text-white disabled:opacity-60">
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
              <button type="button" disabled={saving} onClick={() => setFormMode('closed')} className="min-h-[44px] rounded-md border border-canvas-border px-5 text-sm font-medium text-ink-soft disabled:opacity-60">İptal</button>
            </div>
          </section>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 rounded-xl border border-canvas-border bg-canvas-surface px-4 py-3 text-xs text-ink-soft shadow-card" aria-label="Takvim açıklaması">
          {(Object.keys(ITEM_STYLES) as CalendarItem['kind'][]).map((kind) => (
            <span key={kind} className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${ITEM_STYLES[kind].dot}`} />{ITEM_STYLES[kind].label}</span>
          ))}
        </div>

        <div className="mt-4 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="min-w-0 rounded-xl border border-canvas-border bg-canvas-surface p-3 shadow-card sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <button type="button" onClick={() => changeMonth(-1)} aria-label="Önceki ay" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-canvas-border text-ink-soft hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"><ChevronIcon direction="left" /></button>
              <h2 className="text-center text-lg font-semibold capitalize text-ink">{monthLabel(viewYear, viewMonth)}</h2>
              <button type="button" onClick={() => changeMonth(1)} aria-label="Sonraki ay" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-canvas-border text-ink-soft hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"><ChevronIcon direction="right" /></button>
            </div>

            <div className="grid grid-cols-7 overflow-hidden rounded-lg border-l border-t border-canvas-border">
              {WEEKDAYS.map((weekday) => <div key={weekday} className="border-b border-r border-canvas-border bg-canvas px-0.5 py-2 text-center text-[11px] font-semibold text-ink-soft sm:px-2 sm:text-xs">{weekday}</div>)}
              {calendarCells.map((cell) => {
                const items = itemsByDate.get(cell.key) ?? []
                const isSelected = cell.key === selectedDate
                const isToday = cell.key === todayKey
                return (
                  <button
                    key={cell.key}
                    type="button"
                    onClick={() => setSelectedDate(cell.key)}
                    aria-label={`${formatDate(cell.key)}, ${items.length} kayıt`}
                    aria-pressed={isSelected}
                    className={`min-h-[64px] border-b border-r border-canvas-border p-1 text-left align-top transition-colors sm:min-h-24 sm:p-2 ${isSelected ? 'bg-brand-soft' : cell.isCurrentMonth ? 'bg-canvas-surface' : 'bg-canvas/50'} hover:bg-canvas focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand`}
                  >
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${isToday ? 'bg-brand-dark text-white' : cell.isCurrentMonth ? 'text-ink-soft' : 'text-ink-soft/50'}`}>{Number(cell.key.slice(-2))}</span>
                    <span className="mt-1 flex flex-wrap gap-1 sm:hidden" aria-hidden="true">
                      {items.slice(0, 4).map((item) => <span key={item.id} className={`h-1.5 w-1.5 rounded-full ${ITEM_STYLES[item.kind].dot}`} />)}
                      {items.length > 4 ? <span className="text-[9px] leading-none text-ink-soft">+{items.length - 4}</span> : null}
                    </span>
                    <span className="hidden sm:block">
                      {items.slice(0, 2).map((item) => (
                        <span key={item.id} title={item.label} className={`mt-1 block truncate rounded border px-1 py-0.5 text-[10px] font-medium leading-4 ${ITEM_STYLES[item.kind].badge}`}>{item.label}</span>
                      ))}
                      {items.length > 2 ? <span className="mt-1 block text-[10px] font-medium leading-4 text-ink-soft">+{items.length - 2} kayıt</span> : null}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="rounded-xl border border-canvas-border bg-canvas-surface p-4 shadow-card lg:sticky lg:top-4">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Seçili gün</p>
            <h2 className="mt-1 text-base font-semibold text-ink">{selectedDate ? formatDate(selectedDate) : 'Bir gün seçin'}</h2>
            {!selectedDate || selectedItems.length === 0 ? (
              <p className="mt-4 rounded-lg bg-canvas px-3 py-4 text-sm text-ink-soft">Bu gün için kayıt bulunmuyor.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {selectedItems.map((item) => {
                  const content = (
                    <span className={`flex min-h-[44px] items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${ITEM_STYLES[item.kind].badge}`}>
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ITEM_STYLES[item.kind].dot}`} />
                      <span className="break-words">{item.label}</span>
                    </span>
                  )
                  return <li key={item.id}>{item.linkTo ? <Link to={item.linkTo} className="block rounded-lg hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">{content}</Link> : content}</li>
                })}
              </ul>
            )}
          </section>
        </div>

        {isSuperAdmin && showInactive && manualEntries.some((entry) => entry.deletedAt) ? (
          <section className="mt-5 rounded-xl border border-canvas-border bg-canvas-surface p-4 shadow-card sm:p-5">
            <h2 className="mb-3 text-base font-semibold text-ink">Pasif manuel kayıtlar</h2>
            <ul className="space-y-2">
              {manualEntries.filter((entry) => entry.deletedAt).map((entry) => (
                <li key={entry.id} className="flex flex-col gap-2 rounded-lg border border-canvas-border bg-canvas p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span>{entry.title} · {formatDate(entry.startDate)}</span>
                  <button type="button" onClick={() => void toggleEntry(entry)} className="min-h-[44px] rounded-md px-2 text-left font-medium text-brand-dark hover:underline">Yeniden aktifleştir</button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {isSuperAdmin && manualEntries.some((entry) => !entry.deletedAt) ? (
          <section className="mt-5 rounded-xl border border-canvas-border bg-canvas-surface p-4 shadow-card sm:p-5">
            <h2 className="mb-3 text-base font-semibold text-ink">Manuel kayıtlar</h2>
            <ul className="space-y-2">
              {manualEntries.filter((entry) => !entry.deletedAt).map((entry) => (
                <li key={entry.id} className="flex flex-col gap-2 rounded-lg border border-canvas-border bg-canvas p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span className="break-words">{entry.title} · {formatDate(entry.startDate)}{entry.endDate ? ` – ${formatDate(entry.endDate)}` : ''}</span>
                  <span className="flex gap-2">
                    <button type="button" onClick={() => openEdit(entry)} className="min-h-[44px] rounded-md px-2 font-medium text-brand-dark hover:underline">Düzenle</button>
                    <button type="button" onClick={() => void toggleEntry(entry)} className="min-h-[44px] rounded-md px-2 font-medium text-red-700 hover:underline">Pasifleştir</button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </AppShell>
  )
}
