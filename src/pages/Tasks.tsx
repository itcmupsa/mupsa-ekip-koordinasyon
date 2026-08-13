import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { deleteTaskPermanently } from '../lib/permanentDeletion'
import { useMembershipStatus } from '../hooks/useMembershipStatus'
import AppShell from '../components/AppShell'
import PermanentDeleteDialog from '../components/PermanentDeleteDialog'
import TaskFilterSheet from '../components/tasks/TaskFilterSheet'
import NewTaskPanel from '../components/tasks/NewTaskPanel'

type LoadState = 'loading' | 'ready' | 'error'
type ContextKind = 'event' | 'awareness' | 'standalone'

interface ContextOption {
  id: string
  title: string
  kind: Exclude<ContextKind, 'standalone'>
  ownerId: string | null
  createdBy: string | null
  designResponsibleId: string | null
  pressResponsibleId: string | null
}

interface MemberOption {
  id: string
  name: string
}

interface StatusOption {
  slug: string
  label: string
}

interface Assignment {
  id: string
  profileId: string
  assignmentType: 'primary' | 'supporting' | 'informed'
  displayName: string
}

interface TaskRecord {
  id: string
  periodId: string
  eventId: string | null
  awarenessPostId: string | null
  title: string
  description: string | null
  progressStatus: string
  deadlineAt: string | null
  priority: string
  deletedAt: string | null
  assignments: Assignment[]
}

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Düşük' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Yüksek' },
  { value: 'urgent', label: 'Acil' },
]

function formatDeadline(value: string | null): string {
  if (!value) return 'Son tarih yok'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Son tarih yok'
  return date.toLocaleString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function contextKey(kind: ContextKind, id?: string): string {
  return kind === 'standalone' ? 'standalone' : `${kind}:${id ?? ''}`
}

function splitContextKey(value: string): { kind: ContextKind; id: string | null } {
  if (value === 'standalone') return { kind: 'standalone', id: null }
  const [kind, id] = value.split(':')
  return { kind: kind as ContextKind, id: id || null }
}

function CenteredMessage({ text }: { text: string }) {
  return <div className="flex min-h-screen items-center justify-center bg-canvas px-4"><p className="text-center text-sm text-ink-soft">{text}</p></div>
}

const ASSIGNMENT_LABELS: Record<Assignment['assignmentType'], string> = {
  primary: 'Ana sorumlu',
  supporting: 'Destekleyen',
  informed: 'Bilgilendirilen',
}

const PRIORITY_DOT_CLASSES: Record<string, string> = {
  low: 'bg-emerald-600',
  normal: 'bg-amber-600',
  high: 'bg-red-600',
  urgent: 'bg-red-800',
}

function statusControlClass(slug: string): string {
  if (slug === 'completed') return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  if (slug === 'in_progress' || slug === 'waiting') return 'border-amber-200 bg-amber-50 text-amber-800'
  if (slug === 'cancelled' || slug === 'blocked' || slug === 'overdue') return 'border-red-200 bg-red-50 text-red-700'
  return 'border-canvas-border bg-canvas text-ink-soft'
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
}

function FilterIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><path d="M4 5h16l-6 7v5l-4 2v-7z" /></svg>
}

function PlusIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
}

function CalendarIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="16" rx="2" /><path d="M3.5 9.5h17M8 3v3M16 3v3" /></svg>
}

function PeriodIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="16" rx="2" /><path d="M3.5 9.5h17M8 3v3M16 3v3" /></svg>
}

function PersonIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><circle cx="12" cy="8" r="3.25" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></svg>
}

function ChevronIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
}

function SelectChevronIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><path d="m7 9 5 5 5-5" /></svg>
}

function TaskKindIcon({ kind }: { kind: ContextKind }) {
  const className = kind === 'standalone'
    ? 'bg-brand-soft text-brand-dark'
    : 'bg-accent-soft text-amber-800'

  return (
    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${className}`}>
      {kind === 'awareness' ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><path d="M4 10v3a1 1 0 0 0 1 1h2l4.5 3.5v-11L7 10H5a1 1 0 0 0-1 1zM16.5 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11" /></svg>
      ) : kind === 'event' ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="16" rx="2" /><path d="M3.5 9.5h17M8 3v3M16 3v3" /><circle cx="9" cy="14" r="1" /><circle cx="12.5" cy="14" r="1" /><circle cx="16" cy="14" r="1" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><rect x="5" y="3.5" width="14" height="17" rx="2" /><path d="M9 3.5V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v.5M8.5 11.5l2 2L15 9" /></svg>
      )}
    </span>
  )
}

export default function Tasks({ session }: { session: Session }) {
  const { displayName, hasActiveMembership, periodId, periodLabel, profileId, appRole, coordinatorRoleName, loading: statusLoading } = useMembershipStatus(session)
  const isSuperAdmin = appRole === 'super_admin'
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [events, setEvents] = useState<ContextOption[]>([])
  const [awarenessPosts, setAwarenessPosts] = useState<ContextOption[]>([])
  const [members, setMembers] = useState<MemberOption[]>([])
  const [statuses, setStatuses] = useState<StatusOption[]>([])
  const [reloadKey, setReloadKey] = useState(0)
  const [showInactive, setShowInactive] = useState(false)
  const [search, setSearch] = useState('')
  const [contextFilter, setContextFilter] = useState<'all' | ContextKind>('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [contextSelection, setContextSelection] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [priority, setPriority] = useState('normal')
  const [primaryProfileId, setPrimaryProfileId] = useState('')
  const [supportingProfileId, setSupportingProfileId] = useState('')
  const [informedProfileId, setInformedProfileId] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [formMessage, setFormMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TaskRecord | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const closeFilterSheet = useCallback(() => setFilterSheetOpen(false), [])
  const closeFormPanel = useCallback(() => setFormOpen(false), [])
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
      const result = await deleteTaskPermanently(deleteTarget.id)
      setFormMessage(result.cleanupWarning ?? `“${deleteTarget.title}” görevi kalıcı olarak silindi.`)
      setDeleteTarget(null)
      setReloadKey((value) => value + 1)
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Görev silinemedi.')
    } finally {
      setIsDeleting(false)
    }
  }

  async function toggleTaskActive(task: TaskRecord) {
    if (!isSuperAdmin || !profileId) return
    const deactivate = !task.deletedAt
    if (deactivate && !window.confirm('Bu görevi pasifleştirmek istediğinize emin misiniz?')) return
    setUpdatingTaskId(task.id)
    setFormMessage(null)
    const { error } = await supabase
      .from('tasks')
      .update(deactivate
        ? { deleted_at: new Date().toISOString(), deleted_by: profileId, deletion_note: 'Görev pasifleştirildi' }
        : { deleted_at: null, deleted_by: null, deletion_note: null })
      .eq('id', task.id)
    setUpdatingTaskId(null)
    if (error) {
      setFormMessage(error.message.toLowerCase().includes('kilit') ? 'Dönem kilitli olduğu için işlem yapılamadı.' : 'Görev güncellenemedi.')
      return
    }
    setFormMessage(deactivate ? 'Görev pasifleştirildi.' : 'Görev yeniden aktifleştirildi.')
    setReloadKey((value) => value + 1)
  }

  useEffect(() => {
    if (statusLoading || !hasActiveMembership || !periodId || !profileId) return
    let mounted = true

    async function loadData() {
      setLoadState('loading')
      setLoadError(null)
      const [eventResult, awarenessResult, memberResult, statusResult, taskResult] = await Promise.all([
        supabase.from('events').select('id, title, owner_id').eq('period_id', periodId).is('deleted_at', null).order('title'),
        supabase.from('awareness_posts').select('id, awareness_name, created_by, design_responsible_id, press_publication_responsible_id').eq('period_id', periodId).is('deleted_at', null).order('awareness_name'),
        supabase.from('period_memberships').select('profile_id, period_display_name').eq('period_id', periodId).eq('is_active', true).order('period_display_name'),
        supabase.from('task_progress_statuses').select('slug, label').eq('is_active', true).order('sort_order'),
        showInactive && isSuperAdmin
          ? supabase.from('tasks').select('id, period_id, event_id, awareness_post_id, title, description, progress_status, deadline_at, priority, deleted_at').eq('period_id', periodId).order('deadline_at', { ascending: true, nullsFirst: false })
          : supabase.from('tasks').select('id, period_id, event_id, awareness_post_id, title, description, progress_status, deadline_at, priority, deleted_at').eq('period_id', periodId).is('deleted_at', null).order('deadline_at', { ascending: true, nullsFirst: false }),
      ])

      if (!mounted) return
      if (eventResult.error || awarenessResult.error || memberResult.error || statusResult.error || taskResult.error) {
        setLoadState('error')
        setLoadError('Görev verileri yüklenirken bir hata oluştu.')
        return
      }

      const eventOptions: ContextOption[] = (eventResult.data ?? []).map((row) => ({
        id: row.id as string,
        title: row.title as string,
        kind: 'event',
        ownerId: row.owner_id as string,
        createdBy: null,
        designResponsibleId: null,
        pressResponsibleId: null,
      }))
      const awarenessOptions: ContextOption[] = (awarenessResult.data ?? []).map((row) => ({
        id: row.id as string,
        title: row.awareness_name as string,
        kind: 'awareness',
        ownerId: null,
        createdBy: row.created_by as string,
        designResponsibleId: row.design_responsible_id as string | null,
        pressResponsibleId: row.press_publication_responsible_id as string | null,
      }))
      const memberNameMap = new Map<string, string>((memberResult.data ?? []).map((row) => [row.profile_id as string, (row.period_display_name as string | null) || 'İsimsiz üye']))
      const taskIds = (taskResult.data ?? []).map((row) => row.id as string)
      const assignmentResult = taskIds.length > 0
        ? await supabase.from('task_assignees').select('id, task_id, profile_id, assignment_type').in('task_id', taskIds)
        : { data: [], error: null }
      if (!mounted) return
      if (assignmentResult.error) {
        setLoadState('error')
        setLoadError('Görev atamaları yüklenirken bir hata oluştu.')
        return
      }

      const assignmentsByTask = new Map<string, Assignment[]>()
      for (const row of assignmentResult.data ?? []) {
        const taskId = row.task_id as string
        const assignments = assignmentsByTask.get(taskId) ?? []
        assignments.push({
          id: row.id as string,
          profileId: row.profile_id as string,
          assignmentType: row.assignment_type as Assignment['assignmentType'],
          displayName: memberNameMap.get(row.profile_id as string) ?? 'İsimsiz üye',
        })
        assignmentsByTask.set(taskId, assignments)
      }

      setEvents(eventOptions)
      setAwarenessPosts(awarenessOptions)
      setMembers(Array.from(memberNameMap, ([id, name]) => ({ id, name })))
      setStatuses((statusResult.data ?? []) as StatusOption[])
      setTasks((taskResult.data ?? []).map((row) => ({
        id: row.id as string,
        periodId: row.period_id as string,
        eventId: row.event_id as string | null,
        awarenessPostId: row.awareness_post_id as string | null,
        title: row.title as string,
        description: row.description as string | null,
        progressStatus: row.progress_status as string,
        deadlineAt: row.deadline_at as string | null,
        priority: row.priority as string,
        deletedAt: row.deleted_at as string | null,
        assignments: assignmentsByTask.get(row.id as string) ?? [],
      })))
      setLoadState('ready')
    }

    void loadData()
    return () => { mounted = false }
  }, [hasActiveMembership, isSuperAdmin, periodId, profileId, reloadKey, showInactive, statusLoading])

  const creatableEvents = useMemo(() => isSuperAdmin ? events : events.filter((event) => event.ownerId === profileId), [events, isSuperAdmin, profileId])
  const creatableAwareness = useMemo(() => isSuperAdmin ? awarenessPosts : awarenessPosts.filter((post) => post.createdBy === profileId || post.designResponsibleId === profileId || post.pressResponsibleId === profileId), [awarenessPosts, isSuperAdmin, profileId])
  const canCreateAny = isSuperAdmin || creatableEvents.length > 0 || creatableAwareness.length > 0

  const contextTitle = (task: TaskRecord): string => {
    if (task.eventId) return events.find((event) => event.id === task.eventId)?.title ?? 'Etkinlik'
    if (task.awarenessPostId) return awarenessPosts.find((post) => post.id === task.awarenessPostId)?.title ?? 'Farkındalık'
    return 'Bağımsız görev'
  }

  function isTaskManager(task: TaskRecord): boolean {
    if (isSuperAdmin) return true
    if (task.eventId) return events.some((event) => event.id === task.eventId && event.ownerId === profileId)
    if (task.awarenessPostId) return awarenessPosts.some((post) => post.id === task.awarenessPostId && (post.createdBy === profileId || post.designResponsibleId === profileId || post.pressResponsibleId === profileId))
    return false
  }

  function canSeeDeadline(task: TaskRecord): boolean {
    return isTaskManager(task) || task.assignments.some((assignment) => assignment.profileId === profileId && (assignment.assignmentType === 'primary' || assignment.assignmentType === 'supporting'))
  }

  const visibleTasks = tasks.filter((task) => {
    const normalizedSearch = search.trim().toLocaleLowerCase('tr-TR')
    const kind: ContextKind = task.eventId ? 'event' : task.awarenessPostId ? 'awareness' : 'standalone'
    if (contextFilter !== 'all' && contextFilter !== kind) return false
    if (statusFilter !== 'all' && task.progressStatus !== statusFilter) return false
    if (!normalizedSearch) return true
    return `${task.title} ${contextTitle(task)}`.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
  })

  function resetForm() {
    setContextSelection(isSuperAdmin ? 'standalone' : creatableEvents[0] ? contextKey('event', creatableEvents[0].id) : creatableAwareness[0] ? contextKey('awareness', creatableAwareness[0].id) : '')
    setTitle('')
    setDescription('')
    setDeadline('')
    setPriority('normal')
    setPrimaryProfileId('')
    setSupportingProfileId('')
    setInformedProfileId('')
    setFormError(null)
    setFormMessage(null)
  }

  function openForm() {
    resetForm()
    setFormOpen(true)
  }

  async function createTask() {
    if (!periodId || !profileId) return
    const trimmedTitle = title.trim()
    if (!trimmedTitle) { setFormError('Görev adı zorunludur.'); return }
    if (new Set([primaryProfileId, supportingProfileId, informedProfileId].filter(Boolean)).size !== [primaryProfileId, supportingProfileId, informedProfileId].filter(Boolean).length) {
      setFormError('Aynı kişi aynı görevde birden fazla rolde seçilemez.')
      return
    }
    const { kind, id } = splitContextKey(contextSelection)
    if (kind !== 'standalone' && !id) { setFormError('Görevin bağlı olduğu kayıt seçilmelidir.'); return }
    if (kind === 'standalone' && !isSuperAdmin) { setFormError('Bağımsız görevi yalnızca Süper Yönetici oluşturabilir.'); return }
    let deadlineAt: string | null = null
    if (deadline) {
      const date = new Date(deadline)
      if (Number.isNaN(date.getTime())) { setFormError('Son tarih geçerli değil.'); return }
      deadlineAt = date.toISOString()
    }

    setSaving(true)
    setFormError(null)
    const taskResult = await supabase.from('tasks').insert({
      period_id: periodId,
      event_id: kind === 'event' ? id : null,
      awareness_post_id: kind === 'awareness' ? id : null,
      title: trimmedTitle,
      description: description.trim() || null,
      created_by: profileId,
      activation_status: 'active',
      deadline_at: deadlineAt,
      priority,
    }).select('id').single()

    if (taskResult.error || !taskResult.data) {
      setSaving(false)
      setFormError(taskResult.error?.message.includes('kilit') ? 'Dönem kilitli olduğu için görev oluşturulamadı.' : 'Görev oluşturulamadı.')
      return
    }

    const assignments = [
      primaryProfileId ? { task_id: taskResult.data.id as string, profile_id: primaryProfileId, assignment_type: 'primary', assigned_by: profileId } : null,
      supportingProfileId ? { task_id: taskResult.data.id as string, profile_id: supportingProfileId, assignment_type: 'supporting', assigned_by: profileId } : null,
      informedProfileId ? { task_id: taskResult.data.id as string, profile_id: informedProfileId, assignment_type: 'informed', assigned_by: profileId } : null,
    ].filter((assignment): assignment is { task_id: string; profile_id: string; assignment_type: string; assigned_by: string } => assignment !== null)
    let assignmentWarning = false
    if (assignments.length > 0) {
      const assignmentResult = await supabase.from('task_assignees').insert(assignments)
      if (assignmentResult.error) {
        assignmentWarning = true
      }
    }
    setSaving(false)
    setFormMessage(assignmentWarning ? 'Görev oluşturuldu ancak atama kaydedilemedi; görevi açıp yeniden ata.' : 'Görev oluşturuldu.')
    setFormOpen(false)
    setReloadKey((value) => value + 1)
  }

  async function updateStatus(task: TaskRecord, nextStatus: string) {
    if (!isTaskManager(task) && !task.assignments.some((assignment) => assignment.profileId === profileId && (assignment.assignmentType === 'primary' || assignment.assignmentType === 'supporting'))) return
    setUpdatingTaskId(task.id)
    const { error } = await supabase.from('tasks').update({ progress_status: nextStatus }).eq('id', task.id)
    setUpdatingTaskId(null)
    if (error) { setFormMessage('Görev durumu güncellenemedi.'); return }
    setReloadKey((value) => value + 1)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  if (statusLoading || loadState === 'loading') return <CenteredMessage text="Görevler yükleniyor…" />
  if (!hasActiveMembership || !periodId) return <CenteredMessage text="Aktif dönem üyeliğiniz bulunmuyor." />
  if (loadState === 'error') return <CenteredMessage text={loadError ?? 'Görevler yüklenemedi.'} />

  const roleLabel = coordinatorRoleName ?? (isSuperAdmin ? 'Süper Yönetici' : 'Koordinatör')

  return (
    <AppShell
      isSuperAdmin={isSuperAdmin}
      displayName={displayName}
      roleLabel={roleLabel}
      onSignOut={() => void handleSignOut()}
    >
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mb-5 grid gap-4 lg:flex lg:items-center lg:justify-between">
          <div>
            <p className="inline-flex min-h-[36px] items-center gap-2 rounded-full bg-brand-soft/60 px-3 text-sm text-ink-soft">
              <span className="text-brand-dark"><PeriodIcon /></span>
              Aktif dönem: <span className="font-semibold text-brand-dark">{periodLabel ?? 'Belirtilmedi'}</span>
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Görevler</h1>
            <p className="mt-2 text-sm text-ink-soft sm:text-base">Etkinlik, farkındalık ve bağımsız görevleri tek yerden yönet.</p>
          </div>

          {canCreateAny ? (
            <button
              type="button"
              onClick={openForm}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-accent px-5 text-sm font-semibold text-white shadow-card transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 lg:w-auto"
            >
              <PlusIcon />
              Yeni görev
            </button>
          ) : null}
        </div>

        {formMessage ? (
          <p role="status" className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {formMessage}
          </p>
        ) : null}

        <section className="mb-5 grid gap-3 lg:hidden" aria-label="Görev arama ve filtreleme">
          <label className="relative block">
            <span className="sr-only">Görev veya bağlı kayıt ara</span>
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-soft"><SearchIcon /></span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Görev veya bağlı kayıt ara"
              className="min-h-[48px] w-full rounded-xl border border-canvas-border bg-canvas-surface py-3 pl-11 pr-3 text-sm text-ink shadow-card placeholder:text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
          </label>
          <button
            type="button"
            onClick={() => setFilterSheetOpen(true)}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-canvas-border bg-canvas-surface px-4 text-sm font-medium text-ink shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <FilterIcon />
            Filtreler
            {contextFilter !== 'all' || statusFilter !== 'all' || showInactive ? (
              <span className="h-2 w-2 rounded-full bg-accent" aria-label="Etkin filtre var" />
            ) : null}
          </button>
        </section>

        <section className="mb-5 hidden gap-4 rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-card lg:grid lg:grid-cols-3" aria-label="Görev arama ve filtreleme">
          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Arama</span>
            <span className="relative block">
              <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-brand-dark"><SearchIcon /></span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Görev veya bağlı kayıt ara"
                className="min-h-[58px] w-full rounded-xl border border-canvas-border bg-canvas py-3 pl-12 pr-4 text-sm text-ink transition hover:border-brand/40 focus:bg-canvas-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              />
            </span>
          </label>
          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Bağlı kayıt</span>
            <span className="relative block">
              <select
                value={contextFilter}
                onChange={(event) => setContextFilter(event.target.value as 'all' | ContextKind)}
                className="min-h-[58px] w-full appearance-none rounded-xl border border-canvas-border bg-canvas px-4 py-3 pr-12 text-sm font-medium text-ink transition hover:border-brand/40 focus:bg-canvas-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <option value="all">Tüm bağlı kayıtlar</option>
                <option value="event">Etkinlik görevleri</option>
                <option value="awareness">Farkındalık görevleri</option>
                <option value="standalone">Bağımsız görevler</option>
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-brand-dark"><SelectChevronIcon /></span>
            </span>
          </label>
          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Durum</span>
            <span className="relative block">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="min-h-[58px] w-full appearance-none rounded-xl border border-canvas-border bg-canvas px-4 py-3 pr-12 text-sm font-medium text-ink transition hover:border-brand/40 focus:bg-canvas-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <option value="all">Tüm durumlar</option>
                {statuses.map((status) => <option key={status.slug} value={status.slug}>{status.label}</option>)}
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-brand-dark"><SelectChevronIcon /></span>
            </span>
          </label>
          {isSuperAdmin ? (
            <label className="flex min-h-[44px] items-center gap-2 text-sm text-ink-soft lg:col-span-3">
              <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} className="h-4 w-4 accent-brand" />
              Pasif görevleri göster
            </label>
          ) : null}
        </section>

        {visibleTasks.length === 0 ? (
          <div className="rounded-xl border border-canvas-border bg-canvas-surface px-4 py-8 text-center shadow-card">
            <p className="text-sm font-medium text-ink">Bu filtrelere uygun görev bulunmuyor.</p>
            <p className="mt-1 text-xs text-ink-soft">Arama metnini veya filtreleri değiştirebilirsin.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {visibleTasks.map((task) => {
              const taskKind: ContextKind = task.eventId ? 'event' : task.awarenessPostId ? 'awareness' : 'standalone'
              const taskManager = isTaskManager(task)
              const canUpdate = taskManager || task.assignments.some((assignment) => assignment.profileId === profileId && (assignment.assignmentType === 'primary' || assignment.assignmentType === 'supporting'))
              const linkTo = task.eventId ? `/app/etkinlikler/${task.eventId}` : task.awarenessPostId ? '/app/farkindalik' : null
              const statusLabel = statuses.find((status) => status.slug === task.progressStatus)?.label ?? task.progressStatus
              const priorityLabel = PRIORITY_OPTIONS.find((option) => option.value === task.priority)?.label ?? task.priority
              const taskTypeLabel = taskKind === 'event' ? 'Etkinlik görevi' : taskKind === 'awareness' ? 'Farkındalık görevi' : 'Bağımsız görev'
              const articleClass = [
                'rounded-2xl border p-4 shadow-card sm:p-5',
                task.deletedAt ? 'border-red-200 bg-red-50/40' : 'border-canvas-border bg-canvas-surface',
              ].join(' ')
              const controlClass = [
                'min-h-[44px] max-w-[10rem] rounded-lg border px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                statusControlClass(task.progressStatus),
              ].join(' ')

              return (
                <article key={task.id} className={articleClass}>
                  <div className="flex items-start gap-3 sm:gap-4">
                    <TaskKindIcon kind={taskKind} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs text-ink-soft">{taskTypeLabel}</p>
                          <h2 className="mt-1 break-words text-base font-semibold text-ink">{task.title}</h2>
                        </div>

                        {canUpdate && !task.deletedAt ? (
                          <label className="shrink-0">
                            <span className="sr-only">{task.title} görev durumunu değiştir</span>
                            <select value={task.progressStatus} onChange={(event) => void updateStatus(task, event.target.value)} disabled={updatingTaskId === task.id} className={controlClass}>
                              {statuses.map((status) => <option key={status.slug} value={status.slug}>{status.label}</option>)}
                            </select>
                          </label>
                        ) : (
                          <span className={`flex min-h-[44px] shrink-0 items-center rounded-md border px-3 py-2 text-sm font-medium ${statusControlClass(task.progressStatus)}`}>
                            {statusLabel}
                          </span>
                        )}
                      </div>

                      {linkTo ? (
                        <Link to={linkTo} className="mt-2 inline-flex max-w-full items-center gap-1 text-sm text-ink-soft underline decoration-canvas-border underline-offset-4 hover:text-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                          <span className="truncate">{contextTitle(task)}</span>
                          <ChevronIcon />
                        </Link>
                      ) : null}

                      {task.description ? <p className="mt-2 whitespace-pre-wrap break-words text-sm text-ink-soft">{task.description}</p> : null}

                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-ink-soft">
                        <span className="inline-flex items-center gap-1.5"><CalendarIcon />{canSeeDeadline(task) ? formatDeadline(task.deadlineAt) : 'Son tarih yalnızca görev sorumlularına açıktır'}</span>
                        <span aria-hidden="true" className="hidden text-canvas-border sm:inline">|</span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${PRIORITY_DOT_CLASSES[task.priority] ?? 'bg-ink-soft'}`} />
                          {priorityLabel}
                        </span>
                      </div>

                      {task.assignments.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-soft">
                          {task.assignments.map((assignment) => {
                            const fullLabel = `${ASSIGNMENT_LABELS[assignment.assignmentType]}: ${assignment.displayName}`
                            return (
                              <span key={assignment.id} title={fullLabel} className="inline-flex min-w-0 max-w-full items-center gap-1.5">
                                <PersonIcon />
                                <span className="max-w-[15rem] truncate sm:max-w-[20rem]">{fullLabel}</span>
                              </span>
                            )
                          })}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {isSuperAdmin ? (
                    <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-canvas-border pt-2">
                      <button type="button" onClick={() => void toggleTaskActive(task)} disabled={updatingTaskId === task.id} className={`min-h-[44px] rounded-lg px-3 text-sm font-medium disabled:opacity-50 ${task.deletedAt ? 'text-brand-dark hover:bg-brand-soft' : 'text-danger hover:bg-danger-soft'}`}>{updatingTaskId === task.id ? 'İşleniyor…' : task.deletedAt ? 'Yeniden aktifleştir' : 'Pasifleştir'}</button>
                      {task.deletedAt ? <button type="button" onClick={() => { setFormMessage(null); setDeleteError(null); setDeleteTarget(task) }} className="min-h-[44px] rounded-lg px-3 text-sm font-medium text-danger hover:bg-danger-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger">Kalıcı sil</button> : null}
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}
      </main>

      <TaskFilterSheet
        isOpen={filterSheetOpen}
        isSuperAdmin={isSuperAdmin}
        contextFilter={contextFilter}
        statusFilter={statusFilter}
        showInactive={showInactive}
        statuses={statuses}
        onContextFilterChange={setContextFilter}
        onStatusFilterChange={setStatusFilter}
        onShowInactiveChange={setShowInactive}
        onClose={closeFilterSheet}
      />

      <NewTaskPanel
        isOpen={formOpen}
        isSuperAdmin={isSuperAdmin}
        contextSelection={contextSelection}
        title={title}
        description={description}
        deadline={deadline}
        priority={priority}
        primaryProfileId={primaryProfileId}
        supportingProfileId={supportingProfileId}
        informedProfileId={informedProfileId}
        events={creatableEvents}
        awarenessPosts={creatableAwareness}
        members={members}
        priorities={PRIORITY_OPTIONS}
        error={formError}
        saving={saving}
        onContextSelectionChange={setContextSelection}
        onTitleChange={setTitle}
        onDescriptionChange={setDescription}
        onDeadlineChange={setDeadline}
        onPriorityChange={setPriority}
        onPrimaryProfileIdChange={setPrimaryProfileId}
        onSupportingProfileIdChange={setSupportingProfileId}
        onInformedProfileIdChange={setInformedProfileId}
        contextKeyFor={(kind, id) => contextKey(kind, id)}
        onSubmit={() => void createTask()}
        onClose={closeFormPanel}
      />
      <PermanentDeleteDialog
        isOpen={deleteTarget !== null}
        title="Görevi kalıcı olarak sil"
        itemName={deleteTarget?.title ?? ''}
        description="Görev; atamaları, notları, bildirimleri ve bağlı dosya kayıtlarıyla birlikte kalıcı olarak silinecek."
        isDeleting={isDeleting}
        error={deleteError}
        onClose={closeDeleteDialog}
        onConfirm={() => void handlePermanentDelete()}
      />
    </AppShell>
  )
}
