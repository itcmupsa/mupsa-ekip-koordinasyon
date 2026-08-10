import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useMembershipStatus } from '../hooks/useMembershipStatus'

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

export default function Tasks({ session }: { session: Session }) {
  const { hasActiveMembership, periodId, periodLabel, profileId, appRole, loading: statusLoading } = useMembershipStatus(session)
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

  if (statusLoading || loadState === 'loading') return <CenteredMessage text="Görevler yükleniyor…" />
  if (!hasActiveMembership || !periodId) return <CenteredMessage text="Aktif dönem üyeliğiniz bulunmuyor." />
  if (loadState === 'error') return <CenteredMessage text={loadError ?? 'Görevler yüklenemedi.'} />

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
          <div><p className="text-sm text-ink-soft">Aktif dönem: {periodLabel ?? 'Belirtilmedi'}</p><h1 className="mt-1 text-2xl font-semibold">Görevler</h1><p className="mt-1 text-sm text-ink-soft">Etkinlik, farkındalık ve bağımsız görevleri tek yerden yönet.</p></div>
          {canCreateAny && <button type="button" onClick={openForm} className="rounded-md bg-ink px-3 py-2 text-sm font-medium text-white">Yeni görev</button>}
        </div>

        {formMessage && <p className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{formMessage}</p>}
        {formOpen && <section className="mb-5 rounded-lg border border-canvas-border bg-canvas-surface p-4 shadow-card sm:p-6">
          <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Yeni görev oluştur</h2><button type="button" onClick={() => setFormOpen(false)} className="text-sm text-ink-soft">Kapat</button></div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium">Bağlı kayıt
              <select value={contextSelection} onChange={(event) => setContextSelection(event.target.value)} className="rounded-md border border-canvas-border bg-canvas px-3 py-2 font-normal">
                {isSuperAdmin && <option value="standalone">Bağımsız görev</option>}
                {creatableEvents.length > 0 && <optgroup label="Etkinlikler">{creatableEvents.map((event) => <option key={event.id} value={contextKey('event', event.id)}>{event.title}</option>)}</optgroup>}
                {creatableAwareness.length > 0 && <optgroup label="Farkındalıklar">{creatableAwareness.map((post) => <option key={post.id} value={contextKey('awareness', post.id)}>{post.title}</option>)}</optgroup>}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">Görev adı<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} className="rounded-md border border-canvas-border bg-canvas px-3 py-2 font-normal" /></label>
            <label className="grid gap-1 text-sm font-medium sm:col-span-2">Açıklama<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className="resize-y rounded-md border border-canvas-border bg-canvas px-3 py-2 font-normal" /></label>
            <label className="grid gap-1 text-sm font-medium">Son tarih<input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} className="rounded-md border border-canvas-border bg-canvas px-3 py-2 font-normal" /></label>
            <label className="grid gap-1 text-sm font-medium">Öncelik<select value={priority} onChange={(event) => setPriority(event.target.value)} className="rounded-md border border-canvas-border bg-canvas px-3 py-2 font-normal">{PRIORITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label className="grid gap-1 text-sm font-medium">Ana sorumlu<select value={primaryProfileId} onChange={(event) => setPrimaryProfileId(event.target.value)} className="rounded-md border border-canvas-border bg-canvas px-3 py-2 font-normal"><option value="">Seçiniz</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
            <label className="grid gap-1 text-sm font-medium">Destekleyen<select value={supportingProfileId} onChange={(event) => setSupportingProfileId(event.target.value)} className="rounded-md border border-canvas-border bg-canvas px-3 py-2 font-normal"><option value="">Seçiniz</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
            <label className="grid gap-1 text-sm font-medium">Bilgilendirilen<select value={informedProfileId} onChange={(event) => setInformedProfileId(event.target.value)} className="rounded-md border border-canvas-border bg-canvas px-3 py-2 font-normal"><option value="">Seçiniz</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
          </div>
          {formError && <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
          <button type="button" onClick={() => void createTask()} disabled={saving || !contextSelection} className="mt-4 rounded-md bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{saving ? 'Oluşturuluyor…' : 'Görevi oluştur'}</button>
        </section>}

        <section className="mb-5 grid gap-3 rounded-lg border border-canvas-border bg-canvas-surface p-4 shadow-card sm:grid-cols-3">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Görev veya bağlı kayıt ara" className="rounded-md border border-canvas-border bg-canvas px-3 py-2 text-sm sm:col-span-1" />
          <select value={contextFilter} onChange={(event) => setContextFilter(event.target.value as 'all' | ContextKind)} className="rounded-md border border-canvas-border bg-canvas px-3 py-2 text-sm"><option value="all">Tüm bağlı kayıtlar</option><option value="event">Etkinlik görevleri</option><option value="awareness">Farkındalık görevleri</option><option value="standalone">Bağımsız görevler</option></select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-md border border-canvas-border bg-canvas px-3 py-2 text-sm"><option value="all">Tüm durumlar</option>{statuses.map((status) => <option key={status.slug} value={status.slug}>{status.label}</option>)}</select>
          {isSuperAdmin && <label className="flex items-center gap-2 text-sm text-ink-soft sm:col-span-3"><input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />Pasif görevleri göster</label>}
        </section>

        {visibleTasks.length === 0 ? <p className="rounded-lg border border-canvas-border bg-canvas-surface p-6 text-sm italic text-ink-soft">Bu filtrelere uygun görev bulunmuyor.</p> : <div className="grid gap-3">{visibleTasks.map((task) => {
          const taskKind: ContextKind = task.eventId ? 'event' : task.awarenessPostId ? 'awareness' : 'standalone'
          const taskManager = isTaskManager(task)
          const canUpdate = taskManager || task.assignments.some((assignment) => assignment.profileId === profileId && (assignment.assignmentType === 'primary' || assignment.assignmentType === 'supporting'))
          const linkTo = task.eventId ? `/app/etkinlikler/${task.eventId}` : task.awarenessPostId ? '/app/farkindalik' : null
          const statusLabel = statuses.find((status) => status.slug === task.progressStatus)?.label ?? task.progressStatus
          return <article key={task.id} className={`rounded-lg border p-4 shadow-card ${task.deletedAt ? 'border-red-200 bg-red-50/40' : 'border-canvas-border bg-canvas-surface'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs text-ink-soft">{taskKind === 'event' ? 'Etkinlik görevi' : taskKind === 'awareness' ? 'Farkındalık görevi' : 'Bağımsız görev'}</p><h2 className="mt-1 break-words font-semibold">{task.title}</h2><p className="mt-1 break-words text-sm text-ink-soft">{linkTo ? <Link to={linkTo} className="underline decoration-dotted">{contextTitle(task)}</Link> : contextTitle(task)}</p></div><div className="flex items-center gap-2"><span className="rounded border border-canvas-border bg-canvas px-2 py-1 text-xs">{statusLabel}</span><span className="rounded border border-canvas-border bg-canvas px-2 py-1 text-xs">{PRIORITY_OPTIONS.find((option) => option.value === task.priority)?.label ?? task.priority}</span></div></div>
            {task.description && <p className="mt-3 whitespace-pre-wrap break-words text-sm text-ink-soft">{task.description}</p>}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-soft"><span>{canSeeDeadline(task) ? formatDeadline(task.deadlineAt) : 'Son tarih yalnızca görev sorumlularına açıktır'}</span>{task.assignments.map((assignment) => <span key={assignment.id}>{assignment.displayName} · {assignment.assignmentType === 'primary' ? 'Ana sorumlu' : assignment.assignmentType === 'supporting' ? 'Destekleyen' : 'Bilgilendirilen'}</span>)}</div>
            {canUpdate && !task.deletedAt && <div className="mt-4 flex flex-wrap items-center gap-2"><label className="text-xs text-ink-soft">Durum<select value={task.progressStatus} onChange={(event) => void updateStatus(task, event.target.value)} disabled={updatingTaskId === task.id} className="ml-2 rounded border border-canvas-border bg-canvas px-2 py-1 text-xs"><option value={task.progressStatus}>{statusLabel}</option>{statuses.filter((status) => status.slug !== task.progressStatus).map((status) => <option key={status.slug} value={status.slug}>{status.label}</option>)}</select></label></div>}
          </article>
        })}</div>}
      </main>
    </div>
  )
}
