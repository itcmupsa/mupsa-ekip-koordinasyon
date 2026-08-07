import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useSession } from '../hooks/useSession'
import { useMembershipStatus } from '../hooks/useMembershipStatus'
import { supabase } from '../lib/supabaseClient'

interface EventBasicInfo {
  title: string
  description: string | null
  eventStatus: string | null
  planningDate: string | null
  preparationStartDate: string | null
  estimatedDate: string | null
  confirmedDate: string | null
  ownerId: string | null
  venue: string | null
  nextAction: string | null
}

type LoadState = 'loading' | 'ready' | 'not_found' | 'error'

interface TaskAssigneeInfo {
  id: string
  profileId: string
  displayName: string
  assignmentType: string
}

interface TaskItem {
  id: string
  title: string
  progressStatusSlug: string | null
  progressStatusLabel: string | null
  deadlineAt: string | null
  priority: string | null
  notes: string | null
  assignees: TaskAssigneeInfo[]
}

type TasksLoadState = 'loading' | 'ready' | 'error'

interface PeriodMemberOption {
  profileId: string
  displayName: string
}

interface TaskProgressStatusOption {
  slug: string
  label: string
}

type PeriodMembersLoadState = 'idle' | 'loading' | 'ready' | 'error'

const NOT_SPECIFIED = 'Henüz belirtilmedi'
const TASKS_NOT_FOUND_MESSAGE = 'Bu etkinlik için henüz görev oluşturulmamış.'
const TASKS_ERROR_MESSAGE = 'Görevler yüklenirken bir hata oluştu.'
const TASK_TITLE_REQUIRED_MESSAGE = 'Görev adı boş olamaz.'
const TASK_CREATE_ERROR_MESSAGE = 'Görev oluşturulurken bir hata oluştu.'
const TASK_CREATE_SUCCESS_MESSAGE = 'Görev başarıyla oluşturuldu.'
const TASK_UPDATE_STATUS_ERROR_MESSAGE = 'Görev durumu güncellenirken bir hata oluştu.'
const TASK_UPDATE_STATUS_SUCCESS_MESSAGE = 'Görev durumu başarıyla güncellendi.'
const TASK_UPDATE_NOTE_ERROR_MESSAGE = 'Görev notu güncellenirken bir hata oluştu.'
const TASK_UPDATE_NOTE_SUCCESS_MESSAGE = 'Görev notu başarıyla güncellendi.'

const TASK_PRIORITY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'low', label: 'Düşük' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Yüksek' },
  { value: 'urgent', label: 'Acil' },
]

const TASK_PRIORITY_LABELS: Record<string, string> = {
  low: 'Düşük',
  normal: 'Normal',
  high: 'Yüksek',
  urgent: 'Acil',
}

const ASSIGNMENT_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'primary', label: 'Ana sorumlu' },
  { value: 'supporting', label: 'Destekleyen' },
  { value: 'informed', label: 'Bilgilendirilen' },
]

const ASSIGNEE_REQUIRED_MESSAGE = 'Lütfen bir üye seçin.'
const ASSIGNMENT_DUPLICATE_MESSAGE = 'Bu kişi bu atama türüyle zaten atanmış.'
const ASSIGNMENT_PRIMARY_EXISTS_MESSAGE =
  'Bu görevin zaten bir ana sorumlusu var. Yeni ana sorumlu atamadan önce mevcut ana sorumluyu kaldırın.'
const ASSIGNMENT_CREATE_ERROR_MESSAGE = 'Atama yapılırken bir hata oluştu.'
const ASSIGNMENT_REMOVE_ERROR_MESSAGE = 'Atama kaldırılırken bir hata oluştu.'
const PERIOD_MEMBERS_ERROR_MESSAGE = 'Üyeler yüklenirken bir hata oluştu.'

const ASSIGNMENT_TYPE_LABELS: Record<string, string> = {
  primary: 'Ana sorumlu',
  supporting: 'Destekleyen',
  informed: 'Bilgilendirilen',
}

function extractDateOnly(value: string | null): string {
  if (!value) return ''
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : ''
}

function CenteredMessage({ text }: { text: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <p className="text-center text-sm text-ink-soft">{text}</p>
    </div>
  )
}

function formatDate(value: string | null): string {
  const dateOnly = extractDateOnly(value)
  if (!dateOnly) return 'Tarih henüz belirlenmedi'
  const [year, month, day] = dateOnly.split('-').map(Number)
  const parsed = new Date(year, month - 1, day)
  if (Number.isNaN(parsed.getTime())) return 'Tarih henüz belirlenmedi'
  return parsed.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-medium text-ink-soft">{label}</span>
      <span className="text-sm text-ink">{value}</span>
    </div>
  )
}

function formatDeadline(value: string | null): string {
  if (!value) return 'Son tarih belirtilmedi'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Son tarih belirtilmedi'
  return parsed.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function groupAssigneesByType(assignees: TaskAssigneeInfo[]): Array<{ type: string; names: string[] }> {
  const order: string[] = []
  const groups: Record<string, string[]> = {}
  for (const assignee of assignees) {
    if (!groups[assignee.assignmentType]) {
      groups[assignee.assignmentType] = []
      order.push(assignee.assignmentType)
    }
    groups[assignee.assignmentType].push(assignee.displayName)
  }
  return order.map((type) => ({ type, names: groups[type] }))
}

interface TaskCardProps {
  task: TaskItem
  canManageAssignments: boolean
  canUpdateStatus: boolean
  isPanelOpen: boolean
  onTogglePanel: () => void
  members: PeriodMemberOption[]
  membersLoadState: PeriodMembersLoadState
  availableTaskStatuses: TaskProgressStatusOption[]
  selectedProfileId: string
  onSelectedProfileIdChange: (value: string) => void
  selectedAssignmentType: string
  onSelectedAssignmentTypeChange: (value: string) => void
  onAssign: () => void
  isAssigning: boolean
  assignError: string | null
  onRemove: (assignee: TaskAssigneeInfo) => void
  removingAssignmentId: string | null
  removeError: string | null
  onUpdateStatus: (taskId: string, newStatusSlug: string) => void
  isUpdatingStatus: boolean
  updateStatusError: string | null
  onUpdateNote: (taskId: string, newNote: string) => Promise<boolean>
  isUpdatingNote: boolean
  updateNoteError: string | null
  updateNoteSuccess: string | null
}

function TaskCard({
  task,
  canManageAssignments,
  canUpdateStatus,
  isPanelOpen,
  onTogglePanel,
  members,
  membersLoadState,
  availableTaskStatuses,
  selectedProfileId,
  onSelectedProfileIdChange,
  selectedAssignmentType,
  onSelectedAssignmentTypeChange,
  onAssign,
  isAssigning,
  assignError,
  onRemove,
  removingAssignmentId,
  removeError,
  onUpdateStatus,
  isUpdatingStatus,
  updateStatusError,
  onUpdateNote,
  isUpdatingNote,
  updateNoteError,
  updateNoteSuccess,
}: TaskCardProps) {
  const [isEditingNote, setIsEditingNote] = useState(false)
  const [noteInputValue, setNoteInputValue] = useState(task.notes ?? '')

  useEffect(() => {
    if (!isEditingNote) setNoteInputValue(task.notes ?? '')
  }, [task.notes, isEditingNote])

  async function handleSaveNote() {
    const success = await onUpdateNote(task.id, noteInputValue)
    if (success) setIsEditingNote(false)
  }

  const statusLabel = task.progressStatusLabel ?? task.progressStatusSlug ?? 'Durum belirtilmemiş'
  const priorityLabel = task.priority
    ? TASK_PRIORITY_LABELS[task.priority] ?? task.priority
    : 'Belirtilmemiş'
  const assigneeGroups = groupAssigneesByType(task.assignees)

  return (
    <div className="rounded-md border border-canvas-border bg-canvas px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm font-semibold text-ink">{task.title}</span>
        {canUpdateStatus ? (
          <select
            value={task.progressStatusSlug ?? ''}
            onChange={(event) => onUpdateStatus(task.id, event.target.value)}
            disabled={isUpdatingStatus || availableTaskStatuses.length === 0}
            className="w-fit rounded-md border border-canvas-border bg-canvas-surface px-2 py-1 text-xs font-medium text-ink focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink disabled:opacity-60"
          >
            <option value="" disabled>
              Durum seçin
            </option>
            {availableTaskStatuses.map((status) => (
              <option key={status.slug} value={status.slug}>
                {status.label}
              </option>
            ))}
          </select>
        ) : (
          <span className="inline-flex w-fit items-center rounded-full border border-canvas-border bg-canvas-surface px-2 py-0.5 text-xs font-medium text-ink-soft">
            {statusLabel}
          </span>
        )}
      </div>
      {updateStatusError && <p className="mt-2 text-xs text-red-600">{updateStatusError}</p>}
      <div className="mt-2 flex flex-col gap-1 text-sm text-ink-soft sm:flex-row sm:flex-wrap sm:gap-4">
        <span>Son tarih: {formatDeadline(task.deadlineAt)}</span>
        <span>Öncelik: {priorityLabel}</span>
      </div>
      <div className="mt-2 flex flex-col gap-1 text-sm text-ink-soft">
        {assigneeGroups.length === 0 ? (
          <span>Atanan kişi yok</span>
        ) : (
          assigneeGroups.map((group) => (
            <span key={group.type}>
              {ASSIGNMENT_TYPE_LABELS[group.type] ?? group.type}: {group.names.join(', ')}
            </span>
          ))
        )}
      </div>

      <div className="mt-4 border-t border-canvas-border pt-3">
        <h5 className="text-sm font-medium text-ink-soft">Görev Notu</h5>
        {canUpdateStatus ? (
          isEditingNote ? (
            <div className="mt-2 flex flex-col gap-2">
              <textarea
                value={noteInputValue}
                onChange={(event) => setNoteInputValue(event.target.value)}
                disabled={isUpdatingNote}
                rows={3}
                className="rounded-md border border-canvas-border bg-canvas-surface px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink disabled:opacity-60"
                placeholder="Görev notu ekleyin..."
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleSaveNote()}
                  disabled={isUpdatingNote}
                  className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-canvas-surface disabled:opacity-60"
                >
                  {isUpdatingNote ? 'Kaydediliyor…' : 'Kaydet'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingNote(false)
                    setNoteInputValue(task.notes ?? '')
                  }}
                  disabled={isUpdatingNote}
                  className="rounded-md border border-canvas-border px-4 py-2 text-sm font-medium text-ink-soft disabled:opacity-60"
                >
                  İptal
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex flex-col items-start gap-2">
              {task.notes ? (
                <p className="whitespace-pre-wrap text-sm text-ink">{task.notes}</p>
              ) : (
                <p className="text-sm italic text-ink-soft">Not eklenmemiş</p>
              )}
              <button
                type="button"
                onClick={() => setIsEditingNote(true)}
                className="rounded-md border border-canvas-border bg-canvas-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-canvas"
              >
                {task.notes ? 'Notu Düzenle' : 'Not Ekle'}
              </button>
            </div>
          )
        ) : (
          <div className="mt-2">
            {task.notes ? (
              <p className="whitespace-pre-wrap text-sm text-ink">{task.notes}</p>
            ) : (
              <p className="text-sm italic text-ink-soft">Not eklenmemiş</p>
            )}
          </div>
        )}
        {updateNoteError && <p className="mt-2 text-xs text-red-600">{updateNoteError}</p>}
        {updateNoteSuccess && !isEditingNote && <p className="mt-2 text-xs text-green-600">{updateNoteSuccess}</p>}
      </div>

      {canManageAssignments && (
        <div className="mt-4">
          <button
            type="button"
            onClick={onTogglePanel}
            className="rounded-md border border-canvas-border bg-canvas-surface px-3 py-1.5 text-sm font-medium text-ink hover:bg-canvas"
          >
            {isPanelOpen ? 'Atama panelini kapat' : 'Atama yönetimi'}
          </button>
        </div>
      )}

      {canManageAssignments && isPanelOpen && (
        <div className="mt-3 rounded-md border border-canvas-border bg-canvas-surface px-4 py-4">
          <h4 className="text-sm font-semibold text-ink">Atama yönetimi</h4>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-sm font-medium text-ink-soft" htmlFor={`assignee-select-${task.id}`}>
                Üye
              </label>
              <select
                id={`assignee-select-${task.id}`}
                value={selectedProfileId}
                onChange={(e) => onSelectedProfileIdChange(e.target.value)}
                disabled={isAssigning || membersLoadState === 'loading'}
                className="rounded-md border border-canvas-border bg-canvas px-3 py-2 text-sm text-ink"
              >
                <option value="">Üye seçin</option>
                {members.map((member) => (
                  <option key={member.profileId} value={member.profileId}>
                    {member.displayName}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-sm font-medium text-ink-soft" htmlFor={`assignment-type-select-${task.id}`}>
                Atama türü
              </label>
              <select
                id={`assignment-type-select-${task.id}`}
                value={selectedAssignmentType}
                onChange={(e) => onSelectedAssignmentTypeChange(e.target.value)}
                disabled={isAssigning}
                className="rounded-md border border-canvas-border bg-canvas px-3 py-2 text-sm text-ink"
              >
                {ASSIGNMENT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={onAssign}
              disabled={isAssigning}
              className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-canvas-surface disabled:opacity-60"
            >
              {isAssigning ? 'Atanıyor…' : 'Ata'}
            </button>
          </div>

          {membersLoadState === 'loading' && (
            <p className="mt-2 text-sm text-ink-soft">Üyeler yükleniyor…</p>
          )}
          {membersLoadState === 'error' && (
            <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {PERIOD_MEMBERS_ERROR_MESSAGE}
            </p>
          )}
          {assignError && (
            <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {assignError}
            </p>
          )}

          <div className="mt-4">
            <h5 className="text-sm font-medium text-ink-soft">Mevcut atamalar</h5>
            {task.assignees.length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">Atanan kişi yok</p>
            ) : (
              <div className="mt-2 flex flex-col gap-2">
                {task.assignees.map((assignee) => (
                  <div
                    key={assignee.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-canvas-border bg-canvas px-3 py-2"
                  >
                    <span className="text-sm text-ink">
                      {ASSIGNMENT_TYPE_LABELS[assignee.assignmentType] ?? assignee.assignmentType}:{' '}
                      {assignee.displayName}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemove(assignee)}
                      disabled={removingAssignmentId === assignee.id}
                      className="shrink-0 rounded-md border border-canvas-border px-3 py-1 text-xs font-medium text-ink-soft disabled:opacity-60"
                    >
                      {removingAssignmentId === assignee.id ? 'Kaldırılıyor…' : 'Kaldır'}
                    </button>
                  </div>
                ))}
              </div>
            )}
            {removeError && (
              <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {removeError}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function EventDetail() {
  const { eventId } = useParams<{ eventId: string }>()
  const { session } = useSession()
  const { hasActiveMembership, periodId, profileId, appRole, loading: statusLoading } =
    useMembershipStatus(session)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [event, setEvent] = useState<EventBasicInfo | null>(null)
  const [statusLabel, setStatusLabel] = useState<string | null>(null)
  const [ownerName, setOwnerName] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [editPlanningDate, setEditPlanningDate] = useState('')
  const [editPreparationStartDate, setEditPreparationStartDate] = useState('')
  const [editEstimatedDate, setEditEstimatedDate] = useState('')
  const [editConfirmedDate, setEditConfirmedDate] = useState('')
  const [tasksLoadState, setTasksLoadState] = useState<TasksLoadState>('loading')
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [tasksError, setTasksError] = useState<string | null>(null)
  const [tasksRefreshKey, setTasksRefreshKey] = useState(0)
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDescription, setNewTaskDescription] = useState('')
  const [newTaskDeadline, setNewTaskDeadline] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState('normal')
  const [isCreatingTask, setIsCreatingTask] = useState(false)
  const [createTaskError, setCreateTaskError] = useState<string | null>(null)
  const [taskSuccessMessage, setTaskSuccessMessage] = useState<string | null>(null)
  const [periodMembers, setPeriodMembers] = useState<PeriodMemberOption[]>([])
  const [periodMembersLoadState, setPeriodMembersLoadState] = useState<PeriodMembersLoadState>('idle')
  const [openAssignmentTaskId, setOpenAssignmentTaskId] = useState<string | null>(null)
  const [selectedAssigneeProfileId, setSelectedAssigneeProfileId] = useState('')
  const [selectedAssignmentType, setSelectedAssignmentType] = useState('primary')
  const [isAssigning, setIsAssigning] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)
  const [removingAssignmentId, setRemovingAssignmentId] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [availableTaskStatuses, setAvailableTaskStatuses] = useState<TaskProgressStatusOption[]>([])
  const [updatingStatusTaskId, setUpdatingStatusTaskId] = useState<string | null>(null)
  const [updateStatusErrorMap, setUpdateStatusErrorMap] = useState<Record<string, string>>({})
  const [updatingNoteTaskId, setUpdatingNoteTaskId] = useState<string | null>(null)
  const [updateNoteErrorMap, setUpdateNoteErrorMap] = useState<Record<string, string>>({})
  const [updateNoteSuccessMap, setUpdateNoteSuccessMap] = useState<Record<string, string>>({})

  useEffect(() => {
    if (statusLoading) return
    if (!hasActiveMembership || !periodId || !eventId) {
      setLoadState('ready')
      return
    }

    let isMounted = true
    async function loadEvent() {
      setLoadState('loading')

      const { data, error } = await supabase
        .from('events')
        .select(
          'title, description, event_status, planning_date, preparation_start_date, estimated_date, confirmed_date, owner_id, venue, next_action',
        )
        .eq('id', eventId)
        .eq('period_id', periodId)
        .is('deleted_at', null)
        .maybeSingle()

      if (!isMounted) return
      if (error) {
        setLoadState('error')
        return
      }
      if (!data) {
        setLoadState('not_found')
        return
      }

      const eventStatus = (data.event_status as string | null) ?? null
      const ownerId = (data.owner_id as string | null) ?? null
      setEvent({
        title: data.title as string,
        description: (data.description as string | null) ?? null,
        eventStatus,
        planningDate: (data.planning_date as string | null) ?? null,
        preparationStartDate: (data.preparation_start_date as string | null) ?? null,
        estimatedDate: (data.estimated_date as string | null) ?? null,
        confirmedDate: (data.confirmed_date as string | null) ?? null,
        ownerId,
        venue: (data.venue as string | null) ?? null,
        nextAction: (data.next_action as string | null) ?? null,
      })
      setLoadState('ready')

      if (eventStatus) {
        const { data: statusData } = await supabase
          .from('event_statuses')
          .select('label')
          .eq('slug', eventStatus)
          .maybeSingle()

        if (!isMounted) return
        setStatusLabel((statusData?.label as string | null) ?? null)
      } else {
        setStatusLabel(null)
      }

      if (ownerId) {
        const { data: ownerData } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', ownerId)
          .maybeSingle()

        if (!isMounted) return
        setOwnerName((ownerData?.display_name as string | null) ?? null)
      } else {
        setOwnerName(null)
      }
    }

    void loadEvent()
    return () => {
      isMounted = false
    }
  }, [hasActiveMembership, periodId, eventId, statusLoading])

  useEffect(() => {
    if (statusLoading || !hasActiveMembership) return
    let isMounted = true

    async function loadTaskStatuses() {
      const { data, error } = await supabase
        .from('task_progress_statuses')
        .select('slug, label')
        .order('sort_order', { ascending: true })

      if (!isMounted) return
      if (error) {
        return
      }

      setAvailableTaskStatuses((data ?? []) as TaskProgressStatusOption[])
    }

    void loadTaskStatuses()
    return () => {
      isMounted = false
    }
  }, [hasActiveMembership, statusLoading])

  useEffect(() => {
    if (statusLoading) return
    if (!hasActiveMembership || !eventId) {
      setTasksLoadState('ready')
      setTasks([])
      return
    }

    let isMounted = true
    async function loadTasks() {
      setTasksLoadState('loading')
      setTasksError(null)

      const { data: taskRows, error: tasksErr } = await supabase
        .from('tasks')
        .select('id, title, progress_status, deadline_at, priority, notes')
        .eq('event_id', eventId)
        .is('deleted_at', null)
        .order('deadline_at', { ascending: true, nullsFirst: false })

      if (!isMounted) return
      if (tasksErr) {
        setTasksError(TASKS_ERROR_MESSAGE)
        setTasksLoadState('error')
        return
      }

      const baseTasks: TaskItem[] = (taskRows ?? []).map((row) => ({
        id: row.id as string,
        title: row.title as string,
        progressStatusSlug: (row.progress_status as string | null) ?? null,
        progressStatusLabel: null,
        deadlineAt: (row.deadline_at as string | null) ?? null,
        priority: (row.priority as string | null) ?? null,
        notes: (row.notes as string | null) ?? null,
        assignees: [],
      }))

      if (baseTasks.length === 0) {
        setTasks([])
        setTasksLoadState('ready')
        return
      }

      const statusLabelMap: Record<string, string> = {}
      const slugs = Array.from(
        new Set(baseTasks.map((task) => task.progressStatusSlug).filter((slug): slug is string => !!slug)),
      )
      if (slugs.length > 0) {
        const { data: statusRows } = await supabase
          .from('task_progress_statuses')
          .select('slug, label')
          .in('slug', slugs)

        if (!isMounted) return
        for (const statusRow of statusRows ?? []) {
          statusLabelMap[statusRow.slug as string] = statusRow.label as string
        }
      }

      const assigneesByTask: Record<string, TaskAssigneeInfo[]> = {}
      const taskIds = baseTasks.map((task) => task.id)
      const { data: assigneeRows } = await supabase
        .from('task_assignees')
        .select('id, task_id, profile_id, assignment_type')
        .in('task_id', taskIds)

      if (!isMounted) return
      const profileIds = Array.from(new Set((assigneeRows ?? []).map((row) => row.profile_id as string)))
      const profileNameMap: Record<string, string> = {}
      if (profileIds.length > 0) {
        const { data: profileRows } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', profileIds)

        if (!isMounted) return
        for (const profileRow of profileRows ?? []) {
          profileNameMap[profileRow.id as string] = (profileRow.display_name as string | null) ?? 'İsimsiz üye'
        }
      }

      for (const assigneeRow of assigneeRows ?? []) {
        const taskId = assigneeRow.task_id as string
        if (!assigneesByTask[taskId]) assigneesByTask[taskId] = []
        const profileId = assigneeRow.profile_id as string
        assigneesByTask[taskId].push({
          id: assigneeRow.id as string,
          profileId,
          displayName: profileNameMap[profileId] ?? 'İsimsiz üye',
          assignmentType: assigneeRow.assignment_type as string,
        })
      }

      setTasks(
        baseTasks.map((task) => ({
          ...task,
          progressStatusLabel: task.progressStatusSlug ? statusLabelMap[task.progressStatusSlug] ?? null : null,
          assignees: assigneesByTask[task.id] ?? [],
        })),
      )
      setTasksLoadState('ready')
    }

    void loadTasks()
    return () => {
      isMounted = false
    }
  }, [hasActiveMembership, eventId, statusLoading, tasksRefreshKey])

  function openTaskForm() {
    setNewTaskTitle('')
    setNewTaskDescription('')
    setNewTaskDeadline('')
    setNewTaskPriority('normal')
    setCreateTaskError(null)
    setTaskSuccessMessage(null)
    setIsTaskFormOpen(true)
  }

  function cancelTaskForm() {
    setIsTaskFormOpen(false)
    setCreateTaskError(null)
  }

  async function handleCreateTask() {
    if (!eventId || !profileId) return
    const trimmedTitle = newTaskTitle.trim()
    if (!trimmedTitle) {
      setCreateTaskError(TASK_TITLE_REQUIRED_MESSAGE)
      return
    }

    let deadlineAt: string | null = null
    if (newTaskDeadline) {
      const parsedDeadline = new Date(newTaskDeadline)
      if (Number.isNaN(parsedDeadline.getTime())) {
        setCreateTaskError('Son tarih geçerli değil.')
        return
      }
      deadlineAt = parsedDeadline.toISOString()
    }

    setIsCreatingTask(true)
    setCreateTaskError(null)
    const trimmedDescription = newTaskDescription.trim()
    const { error } = await supabase.from('tasks').insert({
      event_id: eventId,
      title: trimmedTitle,
      description: trimmedDescription || null,
      created_by: profileId,
      deadline_at: deadlineAt,
      priority: newTaskPriority,
    })
    setIsCreatingTask(false)

    if (error) {
      setCreateTaskError(TASK_CREATE_ERROR_MESSAGE)
      return
    }

    setIsTaskFormOpen(false)
    setNewTaskTitle('')
    setNewTaskDescription('')
    setNewTaskDeadline('')
    setNewTaskPriority('normal')
    setTaskSuccessMessage(TASK_CREATE_SUCCESS_MESSAGE)
    setTasksRefreshKey((current) => current + 1)
  }

  async function handleUpdateTaskStatus(taskId: string, newStatusSlug: string) {
    if (!profileId || !availableTaskStatuses.some((status) => status.slug === newStatusSlug)) return

    setUpdatingStatusTaskId(taskId)
    setUpdateStatusErrorMap((previous) => {
      const next = { ...previous }
      delete next[taskId]
      return next
    })
    setTaskSuccessMessage(null)

    const { error } = await supabase
      .from('tasks')
      .update({ progress_status: newStatusSlug })
      .eq('id', taskId)

    setUpdatingStatusTaskId(null)

    if (error) {
      setUpdateStatusErrorMap((previous) => ({
        ...previous,
        [taskId]: TASK_UPDATE_STATUS_ERROR_MESSAGE,
      }))
      return
    }

    setTaskSuccessMessage(TASK_UPDATE_STATUS_SUCCESS_MESSAGE)
    setTasksRefreshKey((current) => current + 1)
  }

  async function handleUpdateTaskNote(taskId: string, newNote: string): Promise<boolean> {
    if (!profileId) return false

    setUpdatingNoteTaskId(taskId)
    setUpdateNoteErrorMap((previous) => {
      const next = { ...previous }
      delete next[taskId]
      return next
    })
    setUpdateNoteSuccessMap((previous) => {
      const next = { ...previous }
      delete next[taskId]
      return next
    })
    setTaskSuccessMessage(null)

    const { error } = await supabase
      .from('tasks')
      .update({ notes: newNote.trim() || null })
      .eq('id', taskId)

    setUpdatingNoteTaskId(null)
    if (error) {
      setUpdateNoteErrorMap((previous) => ({
        ...previous,
        [taskId]: TASK_UPDATE_NOTE_ERROR_MESSAGE,
      }))
      return false
    }

    setUpdateNoteSuccessMap((previous) => ({
      ...previous,
      [taskId]: TASK_UPDATE_NOTE_SUCCESS_MESSAGE,
    }))
    setTasksRefreshKey((current) => current + 1)
    return true
  }

  const isOwner = !!event && !!profileId && event.ownerId === profileId
  const isSuperAdmin = appRole === 'super_admin'
  const canEdit = isOwner || isSuperAdmin

  useEffect(() => {
    if (!canEdit || !periodId) {
      setPeriodMembers([])
      setPeriodMembersLoadState('idle')
      return
    }

    let isMounted = true
    async function loadPeriodMembers() {
      setPeriodMembersLoadState('loading')
      const { data: membershipRows, error: membershipError } = await supabase
        .from('period_memberships')
        .select('profile_id')
        .eq('period_id', periodId)
        .eq('is_active', true)

      if (!isMounted) return
      if (membershipError) {
        setPeriodMembers([])
        setPeriodMembersLoadState('error')
        return
      }

      const profileIds = Array.from(new Set((membershipRows ?? []).map((row) => row.profile_id as string)))
      if (profileIds.length === 0) {
        setPeriodMembers([])
        setPeriodMembersLoadState('ready')
        return
      }

      const { data: profileRows, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', profileIds)

      if (!isMounted) return
      if (profilesError) {
        setPeriodMembers([])
        setPeriodMembersLoadState('error')
        return
      }

      setPeriodMembers(
        (profileRows ?? []).map((row) => ({
          profileId: row.id as string,
          displayName: (row.display_name as string | null) ?? 'İsimsiz üye',
        })),
      )
      setPeriodMembersLoadState('ready')
    }

    void loadPeriodMembers()
    return () => {
      isMounted = false
    }
  }, [canEdit, periodId])

  function toggleAssignmentPanel(taskId: string) {
    if (openAssignmentTaskId === taskId) {
      setOpenAssignmentTaskId(null)
      setAssignError(null)
      setRemoveError(null)
      return
    }
    setOpenAssignmentTaskId(taskId)
    setSelectedAssigneeProfileId('')
    setSelectedAssignmentType('primary')
    setAssignError(null)
    setRemoveError(null)
  }

  async function handleAssignMember(taskId: string) {
    if (!profileId) return
    const task = tasks.find((item) => item.id === taskId)
    if (!task) return
    if (!selectedAssigneeProfileId) {
      setAssignError(ASSIGNEE_REQUIRED_MESSAGE)
      return
    }

    const isDuplicate = task.assignees.some(
      (assignee) =>
        assignee.profileId === selectedAssigneeProfileId &&
        assignee.assignmentType === selectedAssignmentType,
    )
    if (isDuplicate) {
      setAssignError(ASSIGNMENT_DUPLICATE_MESSAGE)
      return
    }
    if (selectedAssignmentType === 'primary' && task.assignees.some((assignee) => assignee.assignmentType === 'primary')) {
      setAssignError(ASSIGNMENT_PRIMARY_EXISTS_MESSAGE)
      return
    }

    setIsAssigning(true)
    setAssignError(null)
    const { error } = await supabase.from('task_assignees').insert({
      task_id: taskId,
      profile_id: selectedAssigneeProfileId,
      assignment_type: selectedAssignmentType,
      assigned_by: profileId,
    })
    setIsAssigning(false)

    if (error) {
      setAssignError(ASSIGNMENT_CREATE_ERROR_MESSAGE)
      return
    }
    setSelectedAssigneeProfileId('')
    setTasksRefreshKey((current) => current + 1)
  }

  async function handleRemoveAssignment(assignee: TaskAssigneeInfo) {
    setRemovingAssignmentId(assignee.id)
    setRemoveError(null)
    const { error } = await supabase.from('task_assignees').delete().eq('id', assignee.id)
    setRemovingAssignmentId(null)

    if (error) {
      setRemoveError(ASSIGNMENT_REMOVE_ERROR_MESSAGE)
      return
    }
    setTasksRefreshKey((current) => current + 1)
  }

  function startEditing() {
    if (!event) return
    setEditTitle(event.title)
    setEditDescription(event.description ?? '')
    setEditPlanningDate(extractDateOnly(event.planningDate))
    setEditPreparationStartDate(extractDateOnly(event.preparationStartDate))
    setEditEstimatedDate(extractDateOnly(event.estimatedDate))
    setEditConfirmedDate(extractDateOnly(event.confirmedDate))
    setSaveError(null)
    setSuccessMessage(null)
    setIsEditing(true)
  }

  function cancelEditing() {
    setIsEditing(false)
    setSaveError(null)
    if (event) {
      setEditTitle(event.title)
      setEditDescription(event.description ?? '')
      setEditPlanningDate(extractDateOnly(event.planningDate))
      setEditPreparationStartDate(extractDateOnly(event.preparationStartDate))
      setEditEstimatedDate(extractDateOnly(event.estimatedDate))
      setEditConfirmedDate(extractDateOnly(event.confirmedDate))
    }
  }

  async function handleSave() {
    if (!eventId || !periodId) return
    const trimmedTitle = editTitle.trim()
    if (!trimmedTitle) {
      setSaveError('Etkinlik adı boş olamaz.')
      return
    }

    setIsSaving(true)
    setSaveError(null)
    const trimmedDescription = editDescription.trim()
    const nextDescription = trimmedDescription.length > 0 ? trimmedDescription : null
    const nextPlanningDate = editPlanningDate || null
    const nextPreparationStartDate = editPreparationStartDate || null
    const nextEstimatedDate = editEstimatedDate || null
    const nextConfirmedDate = editConfirmedDate || null

    const { data, error } = await supabase
      .from('events')
      .update({
        title: trimmedTitle,
        description: nextDescription,
        planning_date: nextPlanningDate,
        preparation_start_date: nextPreparationStartDate,
        estimated_date: nextEstimatedDate,
        confirmed_date: nextConfirmedDate,
      })
      .eq('id', eventId)
      .eq('period_id', periodId)
      .is('deleted_at', null)
      .select('title, description, planning_date, preparation_start_date, estimated_date, confirmed_date')
      .maybeSingle()

    setIsSaving(false)

    if (error) {
      setSaveError('Değişiklikler kaydedilirken bir hata oluştu.')
      return
    }
    if (!data) {
      setSaveError('Etkinlik güncellenemedi. Lütfen sayfayı yenileyip tekrar deneyin.')
      return
    }

    setEvent((current) =>
      current
        ? {
            ...current,
            title: (data.title as string) ?? trimmedTitle,
            description: (data.description as string | null) ?? nextDescription,
            planningDate: (data.planning_date as string | null) ?? nextPlanningDate,
            preparationStartDate: (data.preparation_start_date as string | null) ?? nextPreparationStartDate,
            estimatedDate: (data.estimated_date as string | null) ?? nextEstimatedDate,
            confirmedDate: (data.confirmed_date as string | null) ?? nextConfirmedDate,
          }
        : current,
    )
    setIsEditing(false)
    setSuccessMessage('Etkinlik başarıyla güncellendi.')
  }

  const header = (
    <header className="border-b border-canvas-border bg-canvas-surface">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
        <Link to="/app" className="text-sm font-semibold text-ink">
          MUPSA Ekip Koordinasyon
        </Link>
        <Link to="/app/etkinlikler" className="text-sm font-medium text-ink-soft">
          Etkinliklere dön
        </Link>
      </div>
    </header>
  )

  if (statusLoading || loadState === 'loading') return <CenteredMessage text="Etkinlik yükleniyor…" />
  if (!hasActiveMembership) return <CenteredMessage text="Bu sayfaya erişim yetkin yok." />
  if (loadState === 'error') return <CenteredMessage text="Etkinlik yüklenirken bir hata oluştu." />
  if (loadState === 'not_found' || !event) return <CenteredMessage text="Etkinlik bulunamadı." />

  const displayedStatus = statusLabel ?? event.eventStatus ?? 'Durum belirtilmemiş'
  const displayedOwner = event.ownerId ? ownerName ?? NOT_SPECIFIED : NOT_SPECIFIED
  const displayedVenue = event.venue || NOT_SPECIFIED
  const displayedNextAction = event.nextAction || NOT_SPECIFIED

  return (
    <div className="min-h-screen bg-canvas">
      {header}
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-xl font-semibold text-ink">{event.title}</h1>
          {canEdit && !isEditing && (
            <button
              type="button"
              onClick={startEditing}
              className="shrink-0 rounded-md border border-canvas-border bg-canvas-surface px-3 py-1.5 text-sm font-medium text-ink hover:bg-canvas"
            >
              Düzenle
            </button>
          )}
        </div>

        {successMessage && !isEditing && (
          <p className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            {successMessage}
          </p>
        )}

        {isEditing ? (
          <div className="mt-6 rounded-lg border border-canvas-border bg-canvas-surface p-6 shadow-card">
            <h2 className="text-sm font-semibold text-ink">Etkinliği düzenle</h2>
            <div className="mt-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="event-title" className="text-sm font-medium text-ink-soft">
                  Etkinlik adı
                </label>
                <input
                  id="event-title"
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  disabled={isSaving}
                  className="rounded-md border border-canvas-border bg-canvas px-3 py-2 text-sm text-ink"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="event-description" className="text-sm font-medium text-ink-soft">
                  Açıklama
                </label>
                <textarea
                  id="event-description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  disabled={isSaving}
                  rows={4}
                  className="rounded-md border border-canvas-border bg-canvas px-3 py-2 text-sm text-ink"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label htmlFor="event-planning-date" className="text-sm font-medium text-ink-soft">
                    Planlama tarihi
                  </label>
                  <input
                    id="event-planning-date"
                    type="date"
                    value={editPlanningDate}
                    onChange={(e) => setEditPlanningDate(e.target.value)}
                    disabled={isSaving}
                    className="rounded-md border border-canvas-border bg-canvas px-3 py-2 text-sm text-ink"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="event-preparation-start-date" className="text-sm font-medium text-ink-soft">
                    Hazırlık başlangıç tarihi
                  </label>
                  <input
                    id="event-preparation-start-date"
                    type="date"
                    value={editPreparationStartDate}
                    onChange={(e) => setEditPreparationStartDate(e.target.value)}
                    disabled={isSaving}
                    className="rounded-md border border-canvas-border bg-canvas px-3 py-2 text-sm text-ink"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="event-estimated-date" className="text-sm font-medium text-ink-soft">
                    Tahmini etkinlik tarihi
                  </label>
                  <input
                    id="event-estimated-date"
                    type="date"
                    value={editEstimatedDate}
                    onChange={(e) => setEditEstimatedDate(e.target.value)}
                    disabled={isSaving}
                    className="rounded-md border border-canvas-border bg-canvas px-3 py-2 text-sm text-ink"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="event-confirmed-date" className="text-sm font-medium text-ink-soft">
                    Kesinleşmiş tarih
                  </label>
                  <input
                    id="event-confirmed-date"
                    type="date"
                    value={editConfirmedDate}
                    onChange={(e) => setEditConfirmedDate(e.target.value)}
                    disabled={isSaving}
                    className="rounded-md border border-canvas-border bg-canvas px-3 py-2 text-sm text-ink"
                  />
                </div>
              </div>
              {saveError && (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {saveError}
                </p>
              )}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-canvas-surface disabled:opacity-60"
                >
                  {isSaving ? 'Kaydediliyor…' : 'Kaydet'}
                </button>
                <button
                  type="button"
                  onClick={cancelEditing}
                  disabled={isSaving}
                  className="rounded-md border border-canvas-border px-4 py-2 text-sm font-medium text-ink-soft disabled:opacity-60"
                >
                  İptal
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-lg border border-canvas-border bg-canvas-surface p-6 shadow-card">
            <p className="text-sm text-ink-soft">{event.description || 'Açıklama eklenmemiş'}</p>
          </div>
        )}
        <div className="mt-6 rounded-lg border border-canvas-border bg-canvas-surface p-6 shadow-card">
          <h2 className="text-sm font-semibold text-ink">Durum ve tarihler</h2>
          <div className="mt-3 divide-y divide-canvas-border">
            <DetailRow label="Durum" value={displayedStatus} />
            <DetailRow label="Planlama tarihi" value={formatDate(event.planningDate)} />
            <DetailRow label="Hazırlık başlangıç tarihi" value={formatDate(event.preparationStartDate)} />
            <DetailRow label="Tahmini etkinlik tarihi" value={formatDate(event.estimatedDate)} />
            <DetailRow label="Kesinleşmiş tarih" value={formatDate(event.confirmedDate)} />
          </div>
        </div>
        <div className="mt-6 rounded-lg border border-canvas-border bg-canvas-surface p-6 shadow-card">
          <h2 className="text-sm font-semibold text-ink">Süreç bilgileri</h2>
          <div className="mt-3 divide-y divide-canvas-border">
            <DetailRow label="Sorumlu" value={displayedOwner} />
            <DetailRow label="Mekân" value={displayedVenue} />
            <DetailRow label="Sonraki işlem" value={displayedNextAction} />
          </div>
        </div>
        <div className="mt-6 rounded-lg border border-canvas-border bg-canvas-surface p-6 shadow-card">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-sm font-semibold text-ink">Görevler</h2>
            {canEdit && !isTaskFormOpen && (
              <button
                type="button"
                onClick={openTaskForm}
                className="shrink-0 rounded-md border border-canvas-border bg-canvas px-3 py-1.5 text-sm font-medium text-ink hover:bg-canvas-surface"
              >
                Görev oluştur
              </button>
            )}
          </div>

          {taskSuccessMessage && !isTaskFormOpen && (
            <p className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {taskSuccessMessage}
            </p>
          )}

          {isTaskFormOpen && (
            <div className="mt-4 rounded-md border border-canvas-border bg-canvas px-4 py-4">
              <h3 className="text-sm font-semibold text-ink">Yeni görev</h3>
              <div className="mt-3 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label htmlFor="task-title" className="text-sm font-medium text-ink-soft">
                    Görev adı
                  </label>
                  <input
                    id="task-title"
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    disabled={isCreatingTask}
                    className="rounded-md border border-canvas-border bg-canvas-surface px-3 py-2 text-sm text-ink"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="task-description" className="text-sm font-medium text-ink-soft">
                    Açıklama
                  </label>
                  <textarea
                    id="task-description"
                    value={newTaskDescription}
                    onChange={(e) => setNewTaskDescription(e.target.value)}
                    disabled={isCreatingTask}
                    rows={3}
                    className="rounded-md border border-canvas-border bg-canvas-surface px-3 py-2 text-sm text-ink"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="task-deadline" className="text-sm font-medium text-ink-soft">
                      Son tarih
                    </label>
                    <input
                      id="task-deadline"
                      type="datetime-local"
                      value={newTaskDeadline}
                      onChange={(e) => setNewTaskDeadline(e.target.value)}
                      disabled={isCreatingTask}
                      className="rounded-md border border-canvas-border bg-canvas-surface px-3 py-2 text-sm text-ink"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="task-priority" className="text-sm font-medium text-ink-soft">
                      Öncelik
                    </label>
                    <select
                      id="task-priority"
                      value={newTaskPriority}
                      onChange={(e) => setNewTaskPriority(e.target.value)}
                      disabled={isCreatingTask}
                      className="rounded-md border border-canvas-border bg-canvas-surface px-3 py-2 text-sm text-ink"
                    >
                      {TASK_PRIORITY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {createTaskError && (
                  <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {createTaskError}
                  </p>
                )}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleCreateTask}
                    disabled={isCreatingTask}
                    className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-canvas-surface disabled:opacity-60"
                  >
                    {isCreatingTask ? 'Oluşturuluyor…' : 'Görevi oluştur'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelTaskForm}
                    disabled={isCreatingTask}
                    className="rounded-md border border-canvas-border px-4 py-2 text-sm font-medium text-ink-soft disabled:opacity-60"
                  >
                    İptal
                  </button>
                </div>
              </div>
            </div>
          )}

          {tasksLoadState === 'loading' && (
            <p className="mt-3 text-sm text-ink-soft">Görevler yükleniyor…</p>
          )}
          {tasksLoadState === 'error' && (
            <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {tasksError ?? TASKS_ERROR_MESSAGE}
            </p>
          )}
          {tasksLoadState === 'ready' && tasks.length === 0 && (
            <p className="mt-3 text-sm text-ink-soft">{TASKS_NOT_FOUND_MESSAGE}</p>
          )}
          {tasksLoadState === 'ready' && tasks.length > 0 && (
            <div className="mt-3 flex flex-col gap-3">
              {tasks.map((task) => {
                const isTaskAssigneeWithPermission = task.assignees.some(
                  (assignee) =>
                    assignee.profileId === profileId &&
                    (assignee.assignmentType === 'primary' || assignee.assignmentType === 'supporting'),
                )
                const canUpdateStatus = isSuperAdmin || isOwner || isTaskAssigneeWithPermission

                return (
                  <TaskCard
                    key={task.id}
                    task={task}
                    canManageAssignments={canEdit}
                    canUpdateStatus={canUpdateStatus}
                    isPanelOpen={openAssignmentTaskId === task.id}
                    onTogglePanel={() => toggleAssignmentPanel(task.id)}
                    members={periodMembers}
                    membersLoadState={periodMembersLoadState}
                    availableTaskStatuses={availableTaskStatuses}
                    selectedProfileId={openAssignmentTaskId === task.id ? selectedAssigneeProfileId : ''}
                    onSelectedProfileIdChange={setSelectedAssigneeProfileId}
                    selectedAssignmentType={selectedAssignmentType}
                    onSelectedAssignmentTypeChange={setSelectedAssignmentType}
                    onAssign={() => handleAssignMember(task.id)}
                    isAssigning={isAssigning && openAssignmentTaskId === task.id}
                    assignError={openAssignmentTaskId === task.id ? assignError : null}
                    onRemove={handleRemoveAssignment}
                    removingAssignmentId={removingAssignmentId}
                    removeError={openAssignmentTaskId === task.id ? removeError : null}
                    onUpdateStatus={handleUpdateTaskStatus}
                    isUpdatingStatus={updatingStatusTaskId === task.id}
                    updateStatusError={updateStatusErrorMap[task.id] ?? null}
                    onUpdateNote={handleUpdateTaskNote}
                    isUpdatingNote={updatingNoteTaskId === task.id}
                    updateNoteError={updateNoteErrorMap[task.id] ?? null}
                    updateNoteSuccess={updateNoteSuccessMap[task.id] ?? null}
                  />
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
