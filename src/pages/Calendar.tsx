import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Link, useSearchParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import PermanentDeleteDialog from '../components/PermanentDeleteDialog'
import { supabase } from '../lib/supabaseClient'
import { deleteCalendarEntryPermanently } from '../lib/permanentDeletion'
import { useMembershipStatus } from '../hooks/useMembershipStatus'
import { coordinatorRolePresentation } from '../lib/coordinatorRolePresentation'

type LoadState = 'loading' | 'ready' | 'error'
type FormMode = 'closed' | 'create' | 'edit'
type EntryType = 'academic' | 'official' | 'meeting' | 'other'
type CalendarFilter = 'all' | CalendarItem['kind']

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
  preparationStartDate: string | null
  estimatedDate: string | null
  confirmedDate: string | null
  ownerRoleName: string | null
  ownerRoleSlug: string | null
}

interface CalendarCoordinatorRoleRelation {
  name: string
  slug: string
}

interface CalendarMembershipRow {
  profile_id: string
  coordinator_roles: CalendarCoordinatorRoleRelation | CalendarCoordinatorRoleRelation[] | null
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
  coordinatorRoleName?: string | null
  coordinatorRoleSlug?: string | null
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

function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function calendarItemStyle(item: CalendarItem) {
  if (item.kind !== 'event') return ITEM_STYLES[item.kind]
  const role = coordinatorRolePresentation(item.coordinatorRoleSlug ?? null, item.coordinatorRoleName ?? '')
  return { dot: role.dotClass, badge: role.calendarBadgeClass, label: role.shortLabel || 'Etkinlik' }
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

function TodayIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="16" rx="2" /><path d="M3.5 9.5h17M8 3v3M16 3v3" /></svg>
}

function CloseIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
}

function NoteIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><path d="M6 3.5h9l3 3V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" /><path d="M14 3.5V8h4M8 12h7M8 16h5" /></svg>
}

function TagIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><path d="M20 13 13 20l-9-9V4h7l9 9Z" /><circle cx="8.5" cy="8.5" r="1.25" /></svg>
}

export default function Calendar({ session }: { session: Session }) {
  const [searchParams] = useSearchParams()
  const { displayName, hasActiveMembership, periodId, periodLabel, appRole, coordinatorRoleName, loading: statusLoading } = useMembershipStatus(session)
  const isSuperAdmin = appRole === 'super_admin'

  const [periodStartsOn, setPeriodStartsOn] = useState<string | null>(null)
  const [periodEndsOn, setPeriodEndsOn] = useState<string | null>(null)
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<CalendarFilter>('all')
  const [showAllUpcoming, setShowAllUpcoming] = useState(false)
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

  useEffect(() => {
    const requestedDate = searchParams.get('date')
    const parsed = parseDateOnly(requestedDate)
    if (!requestedDate || !parsed) return
    setSelectedDate(requestedDate)
    setViewYear(parsed.getUTCFullYear())
    setViewMonth(parsed.getUTCMonth())
  }, [searchParams])
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ManualEntry | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const closeDeleteDialog = useCallback(() => {
    if (isDeleting) return
    setDeleteTarget(null)
    setDeleteError(null)
  }, [isDeleting])

  async function handlePermanentDelete() {
    if (!deleteTarget?.deletedAt) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await deleteCalendarEntryPermanently(deleteTarget.id)
      setActionMessage(`“${deleteTarget.title}” takvim kaydı kalıcı olarak silindi.`)
      setDeleteTarget(null)
      setReloadKey((value) => value + 1)
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Takvim kaydı silinemedi.')
    } finally {
      setIsDeleting(false)
    }
  }

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

      const [eventResult, awarenessResult, manualResult, taskResult, membershipResult] = await Promise.all([
        supabase
          .from('events')
          .select('id, title, preparation_start_date, estimated_date, confirmed_date, owner_id')
          .eq('period_id', periodId)
          .is('deleted_at', null),
        supabase
          .from('awareness_posts')
          .select('id, awareness_name, start_date, end_date, estimated_date, share_date, preparation_start_date, closing_date')
          .eq('period_id', periodId)
          .is('deleted_at', null),
        manualQuery,
        supabase.rpc('get_my_calendar_task_deadlines', { target_period_id: periodId }),
        supabase
          .from('period_memberships')
          .select('profile_id, coordinator_roles(name, slug)')
          .eq('period_id', periodId)
          .eq('is_active', true),
      ])

      if (!mounted) return
      if (eventResult.error || awarenessResult.error || manualResult.error || taskResult.error || membershipResult.error) {
        setLoadState('error')
        setLoadError('Takvim verileri yüklenirken bir hata oluştu.')
        return
      }

      const coordinatorRolesByProfile = new Map(
        ((membershipResult.data ?? []) as CalendarMembershipRow[]).map((membership) => {
          const role = pickOne(membership.coordinator_roles)
          return [membership.profile_id, { name: role?.name ?? null, slug: role?.slug ?? null }]
        }),
      )

      setEvents((eventResult.data ?? []).map((row) => ({
        id: row.id as string,
        title: row.title as string,
        preparationStartDate: (row.preparation_start_date as string | null) ?? null,
        estimatedDate: (row.estimated_date as string | null) ?? null,
        confirmedDate: (row.confirmed_date as string | null) ?? null,
        ownerRoleName: coordinatorRolesByProfile.get(row.owner_id as string)?.name ?? null,
        ownerRoleSlug: coordinatorRolesByProfile.get(row.owner_id as string)?.slug ?? null,
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
      const role = { coordinatorRoleName: event.ownerRoleName, coordinatorRoleSlug: event.ownerRoleSlug }
      add(event.preparationStartDate, { id: `${event.id}-preparation`, label: `${event.title} · Hazırlık başlangıcı`, kind: 'event', linkTo: `/app/etkinlikler/${event.id}`, ...role })
      const eventDate = event.confirmedDate ?? event.estimatedDate
      add(eventDate, {
        id: `${event.id}-${event.confirmedDate ? 'confirmed' : 'estimated'}`,
        label: `${event.title} · ${event.confirmedDate ? 'Kesinleşmiş tarih' : 'Tahmini tarih'}`,
        kind: 'event',
        linkTo: `/app/etkinlikler/${event.id}`,
        ...role,
      })
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

  const filteredItemsByDate = useMemo(() => {
    if (activeFilter === 'all') return itemsByDate
    const filtered = new Map<string, CalendarItem[]>()
    for (const [key, items] of itemsByDate) {
      const matches = items.filter((item) => item.kind === activeFilter)
      if (matches.length > 0) filtered.set(key, matches)
    }
    return filtered
  }, [activeFilter, itemsByDate])

  const selectedItems = selectedDate ? filteredItemsByDate.get(selectedDate) ?? [] : []

  const filterOptions = useMemo(() => [
    { value: 'all' as const, label: 'Tümü', count: events.length + awarenessPosts.length + tasks.length + manualEntries.filter((entry) => !entry.deletedAt).length, dot: '' },
    { value: 'event' as const, label: 'Etkinlik', count: events.length, dot: ITEM_STYLES.event.dot },
    { value: 'awareness' as const, label: 'Farkındalık', count: awarenessPosts.length, dot: ITEM_STYLES.awareness.dot },
    { value: 'task' as const, label: 'Görev', count: tasks.length, dot: ITEM_STYLES.task.dot },
    { value: 'manual' as const, label: 'Manuel kayıt', count: manualEntries.filter((entry) => !entry.deletedAt).length, dot: ITEM_STYLES.manual.dot },
  ], [awarenessPosts.length, events.length, manualEntries, tasks.length])

  const upcomingItems = useMemo(() => {
    const now = new Date()
    const startKey = dateKey(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())))
    return Array.from(filteredItemsByDate.entries())
      .filter(([key]) => key >= startKey)
      .flatMap(([key, items]) => items.map((item) => ({ key, item })))
      .sort((first, second) => first.key.localeCompare(second.key) || first.item.label.localeCompare(second.item.label, 'tr-TR'))
  }, [filteredItemsByDate])

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
      ? await supabase.from('calendar_entries').insert({ period_id: periodId, created_by: session.user.id, ...payload }).select('id').single()
      : await supabase.from('calendar_entries').update(payload).eq('id', editingId).select('id').single()
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
    const calendarEntryId = result.data?.id as string | undefined
    if (calendarEntryId) {
      void supabase.functions.invoke('ai-orchestrator', {
        body: { operation: 'calendar_classification', calendar_entry_id: calendarEntryId },
      })
    }
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
  const selectedEntryTypeLabel = ENTRY_TYPES.find((option) => option.value === entryType)?.label ?? 'Diğer'
  const calendarFieldClass = 'min-h-[48px] w-full rounded-xl border border-canvas-border bg-canvas-surface px-3.5 py-3 font-normal text-ink shadow-[0_1px_2px_rgba(15,23,42,0.03)] outline-none transition focus:border-purple-500 focus:ring-3 focus:ring-purple-500/10 disabled:opacity-60'

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
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-[2px] sm:items-center sm:p-5" role="presentation">
            <section role="dialog" aria-modal="true" aria-labelledby="calendar-entry-form-title" className="flex max-h-[100dvh] w-full flex-col overflow-hidden bg-canvas-surface shadow-2xl sm:max-h-[92vh] sm:max-w-5xl sm:rounded-2xl sm:border sm:border-canvas-border">
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-canvas-border bg-gradient-to-r from-purple-50 via-canvas-surface to-canvas-surface px-4 pb-3 sm:px-6 sm:py-5" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}>
                <div className="flex min-w-0 items-center gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-600 text-white shadow-card"><TodayIcon /></span><div className="min-w-0"><h2 id="calendar-entry-form-title" className="truncate text-lg font-semibold text-ink sm:text-xl">{formMode === 'create' ? 'Yeni manuel takvim kaydı' : 'Takvim kaydını düzenle'}</h2><p className="mt-0.5 text-xs text-ink-soft sm:text-sm">Ekibin takviminde görünecek özel kaydın ayrıntılarını belirleyin.</p></div></div>
                <button type="button" aria-label="Kapat" onClick={() => setFormMode('closed')} disabled={saving} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-canvas-border bg-canvas-surface text-ink-soft hover:bg-canvas hover:text-ink disabled:opacity-60"><CloseIcon /></button>
              </div>

              <div className="flex-1 overflow-y-auto bg-canvas px-4 py-5 sm:px-6 sm:py-6">
                <div className="mb-5 grid gap-2.5 sm:grid-cols-3">
                  <div className="flex min-w-0 items-center gap-3 rounded-xl border border-purple-100 bg-canvas-surface p-3.5 shadow-[0_3px_12px_rgba(88,28,135,0.05)]"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-700"><TagIcon /></span><div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Kategori</p><p className="truncate text-sm font-semibold text-ink">{selectedEntryTypeLabel}</p></div></div>
                  <div className="flex min-w-0 items-center gap-3 rounded-xl border border-brand/15 bg-canvas-surface p-3.5 shadow-[0_3px_12px_rgba(15,90,76,0.05)]"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-dark"><TodayIcon /></span><div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Başlangıç</p><p className="truncate text-sm font-semibold text-ink">{startDate ? formatDate(startDate) : 'Tarih seçilmedi'}</p></div></div>
                  <div className="flex min-w-0 items-center gap-3 rounded-xl border border-blue-100 bg-canvas-surface p-3.5 shadow-[0_3px_12px_rgba(3,105,161,0.05)]"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><TodayIcon /></span><div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Bitiş</p><p className="truncate text-sm font-semibold text-ink">{endDate ? formatDate(endDate) : 'Tek günlük kayıt'}</p></div></div>
                </div>

                <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                  <section className="overflow-hidden rounded-2xl border border-canvas-border bg-canvas-surface shadow-[0_4px_18px_rgba(15,23,42,0.04)]">
                    <div className="flex items-center gap-3 border-b border-canvas-border bg-purple-50/55 px-4 py-3.5 sm:px-5"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-600 text-white"><NoteIcon /></span><div><h3 className="text-sm font-semibold text-ink">1. Kayıt bilgileri</h3><p className="mt-0.5 text-xs text-ink-soft">Takvimde görünecek başlık, kategori ve açıklama.</p></div></div>
                    <div className="grid gap-4 p-4 sm:p-5">
                      <label className="grid gap-1.5 text-sm font-medium text-ink">Başlık<input value={title} onChange={(event) => setTitle(event.target.value)} disabled={saving} placeholder="Örn. Değerlendirme toplantısı" className={calendarFieldClass} /></label>
                      <label className="grid gap-1.5 text-sm font-medium text-ink">Kategori<select value={entryType} onChange={(event) => setEntryType(event.target.value as EntryType)} disabled={saving} className={calendarFieldClass}>{ENTRY_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                      <label className="grid gap-1.5 text-sm font-medium text-ink"><span className="flex items-center justify-between"><span>Not <span className="text-xs font-normal text-ink-soft">(isteğe bağlı)</span></span><span className="text-xs font-normal text-ink-soft">{note.length} karakter</span></span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={5} disabled={saving} placeholder="Kaydın amacı, konumu veya önemli ayrıntıları" className={`${calendarFieldClass} min-h-32 resize-y`} /></label>
                    </div>
                  </section>

                  <section className="overflow-hidden rounded-2xl border border-canvas-border bg-canvas-surface shadow-[0_4px_18px_rgba(15,23,42,0.04)]">
                    <div className="flex items-center gap-3 border-b border-canvas-border bg-brand-soft/45 px-4 py-3.5 sm:px-5"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-white"><TodayIcon /></span><div><h3 className="text-sm font-semibold text-ink">2. Tarih aralığı</h3><p className="mt-0.5 text-xs text-ink-soft">Kaydın takvimde hangi günlerde yer alacağını seçin.</p></div></div>
                    <div className="grid gap-4 p-4 sm:p-5">
                      <label className="grid gap-1.5 text-sm font-medium text-ink">Başlangıç tarihi<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} disabled={saving} className={calendarFieldClass} /></label>
                      <div className="flex items-center gap-3" aria-hidden="true"><span className="h-px flex-1 bg-canvas-border" /><span className="rounded-full bg-canvas px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Tarih aralığı</span><span className="h-px flex-1 bg-canvas-border" /></div>
                      <label className="grid gap-1.5 text-sm font-medium text-ink"><span>Bitiş tarihi <span className="text-xs font-normal text-ink-soft">(isteğe bağlı)</span></span><input type="date" min={startDate || undefined} value={endDate} onChange={(event) => setEndDate(event.target.value)} disabled={saving} className={calendarFieldClass} /></label>
                      <p className="flex gap-2 rounded-xl border border-purple-100 bg-purple-50/70 px-3.5 py-3 text-xs leading-5 text-purple-900"><span className="shrink-0 text-purple-700"><TodayIcon /></span><span>{endDate ? 'Kayıt, başlangıç ve bitiş tarihleri arasındaki bütün günlerde gösterilir.' : 'Bitiş tarihi seçmezseniz kayıt yalnızca başlangıç gününde gösterilir.'}</span></p>
                    </div>
                  </section>
                </div>

                {formError ? <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">{formError}</p> : null}
              </div>

              <div className="shrink-0 border-t border-canvas-border bg-canvas-surface px-4 pt-3 sm:flex sm:justify-end sm:gap-3 sm:px-6 sm:py-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.875rem)' }}>
                <div className="flex gap-3 sm:contents"><button type="button" disabled={saving} onClick={() => setFormMode('closed')} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-brand px-5 text-sm font-semibold text-brand-dark hover:bg-brand-soft disabled:opacity-60 sm:flex-none">İptal</button><button type="button" disabled={saving} onClick={() => void saveEntry()} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-purple-600 px-6 text-sm font-semibold text-white shadow-card hover:bg-purple-700 disabled:opacity-60 sm:flex-none">{saving ? 'Kaydediliyor…' : formMode === 'create' ? 'Kaydı oluştur' : 'Değişiklikleri kaydet'}</button></div>
              </div>
            </section>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 rounded-xl border border-canvas-border bg-canvas-surface px-4 py-3 text-xs text-ink-soft shadow-card lg:hidden" aria-label="Takvim açıklaması">
          {(Object.keys(ITEM_STYLES) as CalendarItem['kind'][]).map((kind) => (
            <span key={kind} className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${ITEM_STYLES[kind].dot}`} />{ITEM_STYLES[kind].label}</span>
          ))}
        </div>

        <div className="mt-5 hidden flex-wrap gap-1 rounded-xl border border-canvas-border bg-canvas-surface p-2 text-xs text-ink-soft shadow-card lg:flex" role="radiogroup" aria-label="Takvim kayıtlarını filtrele">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={activeFilter === option.value}
              onClick={() => setActiveFilter(option.value)}
              className={`inline-flex min-h-[36px] items-center gap-2 rounded-lg px-3 font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${activeFilter === option.value ? 'bg-canvas text-ink shadow-sm' : 'hover:bg-canvas/70'}`}
            >
              {option.dot ? <span className={`h-2.5 w-2.5 rounded-full ${option.dot}`} /> : null}
              {option.label}
              <span className="rounded-full bg-canvas-border/60 px-2 py-0.5 text-[11px]">{option.count}</span>
            </button>
          ))}
        </div>

        <div className="mt-4 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="min-w-0 rounded-xl border border-canvas-border bg-canvas-surface p-3 shadow-card sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <button type="button" onClick={() => changeMonth(-1)} aria-label="Önceki ay" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-canvas-border text-ink-soft hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"><ChevronIcon direction="left" /></button>
              <div className="text-center">
                <h2 className="text-lg font-semibold capitalize text-ink">{monthLabel(viewYear, viewMonth)}</h2>
                <p className="mt-1 hidden text-xs text-ink-soft lg:block">{events.length} etkinlik · {tasks.length} görev · {awarenessPosts.length} farkındalık</p>
              </div>
              <button type="button" onClick={() => { const today = new Date(); const key = dateKey(new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))); setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); setSelectedDate(key) }} className="flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-lg border border-canvas-border px-2 text-xs font-medium text-ink-soft hover:bg-canvas sm:px-3 sm:text-sm"><TodayIcon />Bugün</button>
              <button type="button" onClick={() => changeMonth(1)} aria-label="Sonraki ay" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-canvas-border text-ink-soft hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"><ChevronIcon direction="right" /></button>
            </div>

            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {WEEKDAYS.map((weekday, index) => <div key={weekday} className={`rounded-lg px-0.5 py-2 text-center text-[11px] font-semibold text-ink-soft sm:px-2 sm:text-xs ${index >= 5 ? 'bg-brand-soft/60' : 'bg-canvas'}`}>{weekday}</div>)}
              {calendarCells.map((cell, index) => {
                const items = filteredItemsByDate.get(cell.key) ?? []
                const isSelected = cell.key === selectedDate
                const isToday = cell.key === todayKey
                const isWeekend = index % 7 >= 5
                return (
                  <button
                    key={cell.key}
                    type="button"
                    onClick={() => setSelectedDate(cell.key)}
                    aria-label={`${formatDate(cell.key)}, ${items.length} kayıt`}
                    aria-pressed={isSelected}
                    className={`min-h-[64px] rounded-xl border p-1 text-left align-top transition sm:min-h-24 sm:p-2 ${isSelected ? 'border-brand-dark bg-gradient-to-br from-brand to-brand-dark text-white shadow-md' : cell.isCurrentMonth ? isWeekend ? 'border-brand/10 bg-brand-soft/20 hover:bg-brand-soft/50' : 'border-canvas-border bg-canvas-surface hover:bg-canvas' : 'border-canvas-border/70 bg-canvas/50'} focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand`}
                  >
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${isSelected ? 'text-white' : isToday ? 'bg-brand-dark text-white' : cell.isCurrentMonth ? 'text-ink' : 'text-ink-soft/45'}`}>{Number(cell.key.slice(-2))}</span>
                    <span className="mt-1 flex flex-wrap gap-1 sm:hidden" aria-hidden="true">
                      {items.slice(0, 3).map((item) => <span key={item.id} className={`h-1.5 w-1.5 rounded-full ${calendarItemStyle(item).dot} ${isSelected ? 'ring-1 ring-white/70' : ''}`} />)}
                      {items.length > 3 ? <span className={`text-[9px] leading-none ${isSelected ? 'text-white/80' : 'text-ink-soft'}`}>+{items.length - 3}</span> : null}
                    </span>
                    <span className="hidden sm:block">
                      {items.length > 0 ? <span className="mt-1 flex flex-wrap items-center gap-1" aria-hidden="true">{items.slice(0, 4).map((item) => <span key={item.id} className={`h-2 w-2 rounded-full ${calendarItemStyle(item).dot} ${isSelected ? 'ring-1 ring-white/70' : ''}`} />)}{items.length > 4 ? <span className={`text-[10px] font-medium ${isSelected ? 'text-white/80' : 'text-ink-soft'}`}>+{items.length - 4}</span> : null}</span> : null}
                      {items.length === 1 ? <span title={items[0].label} className={`mt-1 block truncate rounded border px-1 py-0.5 text-[10px] font-medium leading-4 ${calendarItemStyle(items[0]).badge}`}>{items[0].label}</span> : null}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          <aside className="space-y-4 lg:sticky lg:top-4">
            <section className="rounded-xl border border-canvas-border bg-canvas-surface p-4 shadow-card">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Seçili gün</p>
              <h2 className="mt-1 text-base font-semibold text-ink">{selectedDate ? formatDate(selectedDate) : 'Bir gün seçin'}</h2>
              {!selectedDate || selectedItems.length === 0 ? (
                <div className="mt-5 grid grid-cols-[4rem_minmax(0,1fr)] items-center gap-4 lg:block lg:text-center">
                  <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-brand-dark"><TodayIcon /></span>
                  <div>
                    <p className="font-semibold text-ink">Bu gün planlanan kayıt yok.</p>
                    <p className="mt-1 text-xs text-ink-soft">Güne harika bir başlangıç yapabilirsin.</p>
                    <div className="mt-4 grid grid-cols-2 gap-2 lg:mt-5">
                      <Link to="/app/etkinlikler?create=1" className="flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-brand-dark px-2 text-xs font-medium text-white hover:brightness-95 sm:px-3 sm:text-sm"><PlusIcon />Etkinlik ekle</Link>
                      <Link to="/app/gorevler?create=1" className="flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-sky-200 px-2 text-xs font-medium text-sky-700 hover:bg-sky-50 sm:px-3 sm:text-sm"><PlusIcon />Görev ekle</Link>
                    </div>
                  </div>
                </div>
              ) : (
                <ul className="mt-4 space-y-2">
                  {selectedItems.map((item) => {
                    const content = (
                      <span className={`flex min-h-[44px] items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${calendarItemStyle(item).badge}`}>
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${calendarItemStyle(item).dot}`} />
                        <span className="break-words">{item.label}</span>
                      </span>
                    )
                    return <li key={item.id}>{item.linkTo ? <Link to={item.linkTo} className="block rounded-lg hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">{content}</Link> : content}</li>
                  })}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-canvas-border bg-canvas-surface p-4 shadow-card">
              <h2 className="text-sm font-semibold text-ink">Yaklaşan kayıtlar</h2>
              {upcomingItems.length === 0 ? <p className="mt-4 text-sm text-ink-soft">Yaklaşan kayıt bulunmuyor.</p> : (
                <ul className="mt-3 divide-y divide-canvas-border">
                  {(showAllUpcoming ? upcomingItems : upcomingItems.slice(0, 5)).map(({ key, item }) => {
                    const date = parseDateOnly(key)
                    const day = date?.getUTCDate()
                    const month = date ? new Intl.DateTimeFormat('tr-TR', { month: 'short', timeZone: 'UTC' }).format(date).toLocaleUpperCase('tr-TR') : ''
                    const content = (
                      <span className="grid min-h-[56px] grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-2 py-2.5">
                        <span className="text-center"><span className="block text-sm font-semibold text-ink">{day}</span><span className="block text-[10px] text-ink-soft">{month}</span></span>
                        <span className="min-w-0"><span className="flex items-center gap-2"><span className={`h-2 w-2 shrink-0 rounded-full ${calendarItemStyle(item).dot}`} /><span className="truncate text-xs font-medium text-ink">{item.label}</span></span></span>
                        <span className={`rounded border px-1.5 py-1 text-[10px] font-medium ${calendarItemStyle(item).badge}`}>{ITEM_STYLES[item.kind].label}</span>
                      </span>
                    )
                    return <li key={`${key}-${item.id}`}>{item.linkTo ? <Link to={item.linkTo} className="block hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">{content}</Link> : content}</li>
                  })}
                </ul>
              )}
              {upcomingItems.length > 5 ? <button type="button" onClick={() => setShowAllUpcoming((current) => !current)} className="mt-2 min-h-[40px] text-xs font-semibold text-sky-700 hover:underline">{showAllUpcoming ? 'Daha az göster' : 'Tümünü görüntüle'}</button> : null}
            </section>
          </aside>
        </div>

        {isSuperAdmin && showInactive && manualEntries.some((entry) => entry.deletedAt) ? (
          <section className="mt-5 rounded-xl border border-canvas-border bg-canvas-surface p-4 shadow-card sm:p-5">
            <h2 className="mb-3 text-base font-semibold text-ink">Pasif manuel kayıtlar</h2>
            <ul className="space-y-2">
              {manualEntries.filter((entry) => entry.deletedAt).map((entry) => (
                <li key={entry.id} className="flex flex-col gap-2 rounded-lg border border-canvas-border bg-canvas p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span>{entry.title} · {formatDate(entry.startDate)}</span>
                  <span className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => void toggleEntry(entry)} className="min-h-[44px] rounded-md px-2 text-left font-medium text-brand-dark hover:underline">Yeniden aktifleştir</button>
                    <button type="button" onClick={() => { setActionMessage(null); setDeleteError(null); setDeleteTarget(entry) }} className="min-h-[44px] rounded-md px-2 font-medium text-danger hover:bg-danger-soft">Kalıcı sil</button>
                  </span>
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
                  <span className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => openEdit(entry)} className="min-h-[44px] rounded-md px-2 font-medium text-brand-dark hover:underline">Düzenle</button>
                    <button type="button" onClick={() => void toggleEntry(entry)} className="min-h-[44px] rounded-md px-2 font-medium text-red-700 hover:underline">Pasifleştir</button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
      <PermanentDeleteDialog
        isOpen={deleteTarget !== null}
        title="Takvim kaydını kalıcı olarak sil"
        itemName={deleteTarget?.title ?? ''}
        description="Bu manuel takvim kaydı kalıcı olarak silinecek ve daha sonra geri getirilemeyecek."
        isDeleting={isDeleting}
        error={deleteError}
        onClose={closeDeleteDialog}
        onConfirm={() => void handlePermanentDelete()}
      />
    </AppShell>
  )
}
