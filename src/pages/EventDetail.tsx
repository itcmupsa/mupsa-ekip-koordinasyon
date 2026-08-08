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

interface TaskDependency {
  id: string
  dependencyType: string
  sourceEventId: string | null
  sourceTaskId: string | null
  requiredSksStatus: string | null
  requiredTaskProgressStatus: string | null
  offsetDays: number | null
}

interface TaskItem {
  id: string
  title: string
  description: string | null
  progressStatusSlug: string | null
  progressStatusLabel: string | null
  deadlineAt: string | null
  priority: string | null
  notes: string | null
  deletedAt: string | null
  assignees: TaskAssigneeInfo[]
  dependencies: TaskDependency[]
}

interface EventDecision {
  id: string
  title: string
  decisionText: string
  decidedAt: string | null
  createdBy: string
  creatorName: string | null
  createdAt: string
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

interface SksStatusOption {
  slug: string
  label: string
}

type PeriodMembersLoadState = 'idle' | 'loading' | 'ready' | 'error'
type DecisionsLoadState = 'idle' | 'loading' | 'ready' | 'error'

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
const ENABLE_TASK_DEPENDENCY_UI = false

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
    hour: '2-digit',
    minute: '2-digit',
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

function formatDateTimeLocal(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
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
  eventId: string
  task: TaskItem
  allTasks: TaskItem[]
  isSuperAdmin: boolean
  canEditTask: boolean
  canManageAssignments: boolean
  canUpdateStatus: boolean
  isPanelOpen: boolean
  onTogglePanel: () => void
  members: PeriodMemberOption[]
  membersLoadState: PeriodMembersLoadState
  availableTaskStatuses: TaskProgressStatusOption[]
  availableSksStatuses: SksStatusOption[]
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
  onUpdateTaskInfo: (
    taskId: string,
    title: string,
    description: string,
    deadline: string,
    priority: string,
  ) => Promise<boolean>
  isUpdatingTaskInfo: boolean
  updateTaskInfoError: string | null
  onDeactivateTask: (taskId: string) => void
  onReactivateTask: (taskId: string) => void
  isProcessingActiveStatus: boolean
  onAddDependency: (
    taskId: string,
    payload: {
      dependencyType: string
      sourceEventId: string | null
      sourceTaskId: string | null
      requiredSksStatus: string | null
      requiredTaskProgressStatus: string | null
      offsetDays: number | null
    },
  ) => Promise<boolean>
  onDeleteDependency: (dependencyId: string) => Promise<boolean>
  isProcessingDependency: boolean
  dependencyError: string | null
}

function TaskCard({
  eventId,
  task,
  allTasks,
  isSuperAdmin,
  canEditTask,
  canManageAssignments,
  canUpdateStatus,
  isPanelOpen,
  onTogglePanel,
  members,
  membersLoadState,
  availableTaskStatuses,
  availableSksStatuses,
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
  onUpdateTaskInfo,
  isUpdatingTaskInfo,
  updateTaskInfoError,
  onDeactivateTask,
  onReactivateTask,
  isProcessingActiveStatus,
  onAddDependency,
  onDeleteDependency,
  isProcessingDependency,
  dependencyError,
}: TaskCardProps) {
  const [isEditingTask, setIsEditingTask] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editDeadline, setEditDeadline] = useState('')
  const [editPriority, setEditPriority] = useState('normal')

  const [isEditingNote, setIsEditingNote] = useState(false)
  const [noteInputValue, setNoteInputValue] = useState(task.notes ?? '')

  const [isAddingDependency, setIsAddingDependency] = useState(false)
  const [dependencyType, setDependencyType] = useState('sks_status')
  const [sourceTaskId, setSourceTaskId] = useState('')
  const [requiredSksStatus, setRequiredSksStatus] = useState('')
  const [requiredTaskProgressStatus, setRequiredTaskProgressStatus] = useState('')
  const [offsetDays, setOffsetDays] = useState<number | ''>('')
  const [dependencyFormError, setDependencyFormError] = useState<string | null>(null)
  const [deletingDependencyId, setDeletingDependencyId] = useState<string | null>(null)

  const isDeactivated = !!task.deletedAt
  const effectiveCanEditTask = canEditTask && !isDeactivated
  const effectiveCanUpdateStatus = canUpdateStatus && !isDeactivated
  const effectiveCanManageAssignments = canManageAssignments && !isDeactivated

  useEffect(() => {
    if (!isEditingNote) setNoteInputValue(task.notes ?? '')
  }, [task.notes, isEditingNote])

  async function handleSaveNote() {
    const success = await onUpdateNote(task.id, noteInputValue)
    if (success) setIsEditingNote(false)
  }

  function startEditingTask() {
    setEditTitle(task.title)
    setEditDescription(task.description ?? '')
    setEditDeadline(formatDateTimeLocal(task.deadlineAt))
    setEditPriority(task.priority ?? 'normal')
    setIsEditingTask(true)
  }

  async function handleSaveTaskInfo() {
    const success = await onUpdateTaskInfo(task.id, editTitle, editDescription, editDeadline, editPriority)
    if (success) setIsEditingTask(false)
  }

  async function handleSaveDependency() {
    setDependencyFormError(null)
    if (dependencyType === 'sks_status' && !requiredSksStatus) {
      setDependencyFormError('Lütfen gerekli SKS durumunu seçin.')
      return
    }
    if (dependencyType === 'task_progress' && (!sourceTaskId || !requiredTaskProgressStatus)) {
      setDependencyFormError('Lütfen kaynak görevi ve beklenen durumu seçin.')
      return
    }
    if (dependencyType === 'event_date_offset' && offsetDays === '') {
      setDependencyFormError('Lütfen gün farkını girin.')
      return
    }

    const success = await onAddDependency(task.id, {
      dependencyType,
      sourceEventId: dependencyType === 'task_progress' ? null : eventId,
      sourceTaskId: dependencyType === 'task_progress' ? sourceTaskId : null,
      requiredSksStatus: dependencyType === 'sks_status' ? requiredSksStatus : null,
      requiredTaskProgressStatus: dependencyType === 'task_progress' ? requiredTaskProgressStatus : null,
      offsetDays: dependencyType === 'event_date_offset' ? Number(offsetDays) : null,
    })

    if (success) {
      setIsAddingDependency(false)
      setDependencyType('sks_status')
      setSourceTaskId('')
      setRequiredSksStatus('')
      setRequiredTaskProgressStatus('')
      setOffsetDays('')
    }
  }

  async function handleDeleteDependency(dependencyId: string) {
    if (!window.confirm('Bu bağımlılığı silmek istediğinize emin misiniz?')) return
    setDeletingDependencyId(dependencyId)
    await onDeleteDependency(dependencyId)
    setDeletingDependencyId(null)
  }

  const sksStatusLabels = Object.fromEntries(availableSksStatuses.map((status) => [status.slug, status.label]))
  const taskStatusLabels = Object.fromEntries(availableTaskStatuses.map((status) => [status.slug, status.label]))
  const taskTitles = Object.fromEntries(allTasks.map((item) => [item.id, item.title]))
  const otherTasks = allTasks.filter((item) => item.id !== task.id && !item.deletedAt)

  function dependencyDescription(dependency: TaskDependency): string {
    if (dependency.dependencyType === 'sks_status') {
      return `SKS durumu: ${sksStatusLabels[dependency.requiredSksStatus ?? ''] ?? dependency.requiredSksStatus ?? 'Belirtilmemiş'}`
    }
    if (dependency.dependencyType === 'task_progress') {
      const title = taskTitles[dependency.sourceTaskId ?? ''] ?? 'Bilinmeyen görev'
      const status = taskStatusLabels[dependency.requiredTaskProgressStatus ?? ''] ?? dependency.requiredTaskProgressStatus
      return `${title} görevi ${status ?? 'belirli duruma'} gelince`
    }
    const offset = dependency.offsetDays ?? 0
    if (offset === 0) return 'Etkinlik günü'
    return `Etkinlik tarihinden ${Math.abs(offset)} gün ${offset < 0 ? 'önce' : 'sonra'}`
  }

  const statusLabel = task.progressStatusLabel ?? task.progressStatusSlug ?? 'Durum belirtilmemiş'
  const priorityLabel = task.priority
    ? TASK_PRIORITY_LABELS[task.priority] ?? task.priority
    : 'Belirtilmemiş'
  const assigneeGroups = groupAssigneesByType(task.assignees)

  return (
    <div className={`rounded-md border border-canvas-border px-4 py-3 transition-opacity ${isDeactivated ? 'bg-canvas-surface opacity-80' : 'bg-canvas shadow-sm'}`}>
      {isEditingTask ? (
        <div className="mb-4 flex flex-col gap-4 border-b border-canvas-border pb-4">
          <h4 className="text-sm font-semibold text-ink">Görevi düzenle</h4>
          <label className="flex flex-col gap-1 text-xs font-medium text-ink-soft">
            Görev adı
            <input
              value={editTitle}
              onChange={(event) => setEditTitle(event.target.value)}
              disabled={isUpdatingTaskInfo}
              className="rounded-md border border-canvas-border bg-canvas-surface px-3 py-1.5 text-sm text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-ink-soft">
            Açıklama
            <textarea
              value={editDescription}
              onChange={(event) => setEditDescription(event.target.value)}
              disabled={isUpdatingTaskInfo}
              rows={2}
              className="rounded-md border border-canvas-border bg-canvas-surface px-3 py-1.5 text-sm text-ink"
            />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-ink-soft">
              Son tarih
              <input
                type="datetime-local"
                value={editDeadline}
                onChange={(event) => setEditDeadline(event.target.value)}
                disabled={isUpdatingTaskInfo}
                className="rounded-md border border-canvas-border bg-canvas-surface px-3 py-1.5 text-sm text-ink"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-ink-soft">
              Öncelik
              <select
                value={editPriority}
                onChange={(event) => setEditPriority(event.target.value)}
                disabled={isUpdatingTaskInfo}
                className="rounded-md border border-canvas-border bg-canvas-surface px-3 py-1.5 text-sm text-ink"
              >
                {TASK_PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {updateTaskInfoError && <p className="text-xs text-red-600">{updateTaskInfoError}</p>}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleSaveTaskInfo()}
              disabled={isUpdatingTaskInfo}
              className="rounded-md bg-ink px-4 py-2 text-xs font-medium text-canvas-surface disabled:opacity-60"
            >
              {isUpdatingTaskInfo ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            <button
              type="button"
              onClick={() => setIsEditingTask(false)}
              disabled={isUpdatingTaskInfo}
              className="rounded-md border border-canvas-border px-4 py-2 text-xs font-medium text-ink-soft disabled:opacity-60"
            >
              İptal
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-ink">{task.title}</span>
                {isDeactivated && (
                  <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                    Pasif görev
                  </span>
                )}
                {effectiveCanEditTask && (
                  <button
                    type="button"
                    onClick={startEditingTask}
                    className="rounded border border-canvas-border bg-canvas-surface px-2 py-0.5 text-xs font-medium text-ink-soft"
                  >
                    Düzenle
                  </button>
                )}
                {isSuperAdmin && !isDeactivated && (
                  <button
                    type="button"
                    onClick={() => onDeactivateTask(task.id)}
                    disabled={isProcessingActiveStatus}
                    className="rounded border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 disabled:opacity-60"
                  >
                    Pasifleştir
                  </button>
                )}
                {isSuperAdmin && isDeactivated && (
                  <button
                    type="button"
                    onClick={() => onReactivateTask(task.id)}
                    disabled={isProcessingActiveStatus}
                    className="rounded border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 disabled:opacity-60"
                  >
                    Yeniden aktifleştir
                  </button>
                )}
              </div>
              {task.description && <p className="whitespace-pre-wrap text-sm text-ink-soft">{task.description}</p>}
            </div>
            {effectiveCanUpdateStatus ? (
              <select
                value={task.progressStatusSlug ?? ''}
                onChange={(event) => onUpdateStatus(task.id, event.target.value)}
                disabled={isUpdatingStatus || availableTaskStatuses.length === 0}
                className="mt-2 w-fit rounded-md border border-canvas-border bg-canvas-surface px-2 py-1 text-xs font-medium text-ink focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink disabled:opacity-60 sm:mt-0"
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
              <span className="mt-2 inline-flex w-fit items-center rounded-full border border-canvas-border bg-canvas-surface px-2 py-0.5 text-xs font-medium text-ink-soft sm:mt-0">
                {statusLabel}
              </span>
            )}
          </div>
          {updateStatusError && <p className="mt-2 text-xs text-red-600">{updateStatusError}</p>}
          <div className="mt-2 flex flex-col gap-1 text-sm text-ink-soft sm:flex-row sm:flex-wrap sm:gap-4">
            <span>Son tarih: {formatDeadline(task.deadlineAt)}</span>
            <span>Öncelik: {priorityLabel}</span>
          </div>
        </>
      )}
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

      {ENABLE_TASK_DEPENDENCY_UI && (
        <div className="mt-4 border-t border-canvas-border pt-3">
          <div className="flex items-center justify-between">
            <h5 className="text-sm font-medium text-ink-soft">Bağımlılıklar</h5>
            {effectiveCanEditTask && !isAddingDependency && (
              <button
                type="button"
                onClick={() => setIsAddingDependency(true)}
                className="text-xs font-medium text-ink hover:underline"
              >
                Bağımlılık ekle
              </button>
            )}
          </div>

          {task.dependencies.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-2">
              {task.dependencies.map((dependency) => (
                <li
                  key={dependency.id}
                  className="flex flex-col gap-2 rounded-md bg-canvas-surface px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="text-xs text-ink">{dependencyDescription(dependency)}</span>
                  {effectiveCanEditTask && (
                    <button
                      type="button"
                      onClick={() => void handleDeleteDependency(dependency.id)}
                      disabled={deletingDependencyId === dependency.id}
                      className="shrink-0 text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                    >
                      {deletingDependencyId === dependency.id ? 'Siliniyor…' : 'Sil'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            !isAddingDependency && <p className="mt-2 text-xs italic text-ink-soft">Bağımlılık eklenmemiş.</p>
          )}

          {isAddingDependency && effectiveCanEditTask && (
            <div className="mt-3 flex flex-col gap-3 rounded-md border border-canvas-border p-3">
              <label className="flex flex-col gap-1 text-xs font-medium text-ink-soft">
                Bağımlılık türü
                <select
                  value={dependencyType}
                  onChange={(event) => {
                    setDependencyType(event.target.value)
                    setDependencyFormError(null)
                  }}
                  disabled={isProcessingDependency}
                  className="rounded-md border border-canvas-border bg-canvas px-2 py-1.5 text-xs text-ink"
                >
                  <option value="sks_status">SKS durumu</option>
                  <option value="task_progress">Görev durumu</option>
                  <option value="event_date_offset">Etkinlik tarih farkı</option>
                </select>
              </label>

              {dependencyType === 'sks_status' && (
                <label className="flex flex-col gap-1 text-xs font-medium text-ink-soft">
                  Gerekli SKS durumu
                  <select
                    value={requiredSksStatus}
                    onChange={(event) => setRequiredSksStatus(event.target.value)}
                    disabled={isProcessingDependency}
                    className="rounded-md border border-canvas-border bg-canvas px-2 py-1.5 text-xs text-ink"
                  >
                    <option value="" disabled>
                      SKS durumu seçin
                    </option>
                    {availableSksStatuses.map((status) => (
                      <option key={status.slug} value={status.slug}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {dependencyType === 'task_progress' && (
                <>
                  <label className="flex flex-col gap-1 text-xs font-medium text-ink-soft">
                    Kaynak görev
                    <select
                      value={sourceTaskId}
                      onChange={(event) => setSourceTaskId(event.target.value)}
                      disabled={isProcessingDependency}
                      className="rounded-md border border-canvas-border bg-canvas px-2 py-1.5 text-xs text-ink"
                    >
                      <option value="" disabled>
                        Görev seçin
                      </option>
                      {otherTasks.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-ink-soft">
                    Beklenen durum
                    <select
                      value={requiredTaskProgressStatus}
                      onChange={(event) => setRequiredTaskProgressStatus(event.target.value)}
                      disabled={isProcessingDependency}
                      className="rounded-md border border-canvas-border bg-canvas px-2 py-1.5 text-xs text-ink"
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
                  </label>
                </>
              )}

              {dependencyType === 'event_date_offset' && (
                <label className="flex flex-col gap-1 text-xs font-medium text-ink-soft">
                  Gün farkı (- önce, + sonra)
                  <input
                    type="number"
                    value={offsetDays}
                    onChange={(event) => setOffsetDays(event.target.value === '' ? '' : Number(event.target.value))}
                    disabled={isProcessingDependency}
                    placeholder="Örn: -3, 0 veya 5"
                    className="rounded-md border border-canvas-border bg-canvas px-2 py-1.5 text-xs text-ink"
                  />
                </label>
              )}

              {(dependencyFormError || dependencyError) && (
                <p className="text-xs text-red-600">{dependencyFormError ?? dependencyError}</p>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleSaveDependency()}
                  disabled={isProcessingDependency}
                  className="rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-canvas-surface disabled:opacity-60"
                >
                  {isProcessingDependency ? 'Kaydediliyor…' : 'Kaydet'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingDependency(false)}
                  disabled={isProcessingDependency}
                  className="rounded-md border border-canvas-border px-3 py-1.5 text-xs font-medium text-ink-soft disabled:opacity-60"
                >
                  İptal
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 border-t border-canvas-border pt-3">
        <h5 className="text-sm font-medium text-ink-soft">Görev Notu</h5>
        {effectiveCanUpdateStatus ? (
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

      {effectiveCanManageAssignments && (
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

      {effectiveCanManageAssignments && isPanelOpen && (
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
  const [showInactiveTasks, setShowInactiveTasks] = useState(false)
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
  const [updatingTaskInfoId, setUpdatingTaskInfoId] = useState<string | null>(null)
  const [updateTaskInfoErrorMap, setUpdateTaskInfoErrorMap] = useState<Record<string, string>>({})
  const [processingActiveStatusTaskId, setProcessingActiveStatusTaskId] = useState<string | null>(null)
  const [availableSksStatuses, setAvailableSksStatuses] = useState<SksStatusOption[]>([])
  const [processingDependencyTaskId, setProcessingDependencyTaskId] = useState<string | null>(null)
  const [dependencyErrorMap, setDependencyErrorMap] = useState<Record<string, string>>({})

  // Decisions State
  const [decisionsLoadState, setDecisionsLoadState] = useState<DecisionsLoadState>('idle')
  const [decisions, setDecisions] = useState<EventDecision[]>([])
  const [decisionsRefreshKey, setDecisionsRefreshKey] = useState(0)
  const [isDecisionFormOpen, setIsDecisionFormOpen] = useState(false)
  const [decisionFormMode, setDecisionFormMode] = useState<'create' | 'edit'>('create')
  const [editingDecisionId, setEditingDecisionId] = useState<string | null>(null)
  const [decisionTitle, setDecisionTitle] = useState('')
  const [decisionText, setDecisionText] = useState('')
  const [decisionDate, setDecisionDate] = useState('')
  const [isSavingDecision, setIsSavingDecision] = useState(false)
  const [decisionFormError, setDecisionFormError] = useState<string | null>(null)
  const [decisionSuccessMessage, setDecisionSuccessMessage] = useState<string | null>(null)
  const [deactivatingDecisionId, setDeactivatingDecisionId] = useState<string | null>(null)

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

    async function loadSksStatuses() {
      const { data, error } = await supabase
        .from('sks_statuses')
        .select('slug, label')
        .order('sort_order', { ascending: true })

      if (!isMounted || error) return
      setAvailableSksStatuses((data ?? []) as SksStatusOption[])
    }

    void loadTaskStatuses()
    void loadSksStatuses()
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

      let tasksQuery = supabase
        .from('tasks')
        .select('id, title, description, progress_status, deadline_at, priority, notes, deleted_at')
        .eq('event_id', eventId)
        .order('deadline_at', { ascending: true, nullsFirst: false })

      if (appRole !== 'super_admin' || !showInactiveTasks) {
        tasksQuery = tasksQuery.is('deleted_at', null)
      }

      const { data: taskRows, error: tasksErr } = await tasksQuery

      if (!isMounted) return
      if (tasksErr) {
        setTasksError(TASKS_ERROR_MESSAGE)
        setTasksLoadState('error')
        return
      }

      const baseTasks: TaskItem[] = (taskRows ?? []).map((row) => ({
        id: row.id as string,
        title: row.title as string,
        description: (row.description as string | null) ?? null,
        progressStatusSlug: (row.progress_status as string | null) ?? null,
        progressStatusLabel: null,
        deadlineAt: (row.deadline_at as string | null) ?? null,
        priority: (row.priority as string | null) ?? null,
        notes: (row.notes as string | null) ?? null,
        deletedAt: (row.deleted_at as string | null) ?? null,
        assignees: [],
        dependencies: [],
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

      const { data: dependencyRows } = await supabase
        .from('task_dependencies')
        .select(
          'id, task_id, dependency_type, source_event_id, source_task_id, required_sks_status, required_task_progress_status, offset_days',
        )
        .in('task_id', taskIds)

      if (!isMounted) return
      const dependenciesByTask: Record<string, TaskDependency[]> = {}
      for (const row of dependencyRows ?? []) {
        const targetTaskId = row.task_id as string
        if (!dependenciesByTask[targetTaskId]) dependenciesByTask[targetTaskId] = []
        dependenciesByTask[targetTaskId].push({
          id: row.id as string,
          dependencyType: row.dependency_type as string,
          sourceEventId: (row.source_event_id as string | null) ?? null,
          sourceTaskId: (row.source_task_id as string | null) ?? null,
          requiredSksStatus: (row.required_sks_status as string | null) ?? null,
          requiredTaskProgressStatus: (row.required_task_progress_status as string | null) ?? null,
          offsetDays: typeof row.offset_days === 'number' ? row.offset_days : null,
        })
      }

      setTasks(
        baseTasks.map((task) => ({
          ...task,
          progressStatusLabel: task.progressStatusSlug ? statusLabelMap[task.progressStatusSlug] ?? null : null,
          assignees: assigneesByTask[task.id] ?? [],
          dependencies: dependenciesByTask[task.id] ?? [],
        })),
      )
      setTasksLoadState('ready')
    }

    void loadTasks()
    return () => {
      isMounted = false
    }
  }, [hasActiveMembership, eventId, statusLoading, tasksRefreshKey, appRole, showInactiveTasks])

  useEffect(() => {
    if (statusLoading || !hasActiveMembership || !eventId) return
    let isMounted = true

    async function loadDecisions() {
      setDecisionsLoadState('loading')
      const { data, error } = await supabase
        .from('event_decisions')
        .select('id, title, decision_text, decided_at, created_by, created_at')
        .eq('event_id', eventId)
        .is('deleted_at', null)
        .order('decided_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })

      if (!isMounted) return
      if (error) {
        setDecisionsLoadState('error')
        return
      }

      const creatorIds = Array.from(new Set((data ?? []).map((d) => d.created_by)))
      const profileMap: Record<string, string> = {}
      if (creatorIds.length > 0) {
        const { data: profilesData } = await supabase.from('profiles').select('id, display_name').in('id', creatorIds)
        if (profilesData) {
          for (const p of profilesData) {
            profileMap[p.id] = p.display_name
          }
        }
      }

      setDecisions(
        (data ?? []).map((row) => ({
          id: row.id as string,
          title: row.title as string,
          decisionText: row.decision_text as string,
          decidedAt: (row.decided_at as string | null) ?? null,
          createdBy: row.created_by as string,
          creatorName: profileMap[row.created_by as string] || 'Bilinmeyen Kullanıcı',
          createdAt: row.created_at as string,
        }))
      )
      setDecisionsLoadState('ready')
    }

    void loadDecisions()
    return () => {
      isMounted = false
    }
  }, [hasActiveMembership, eventId, statusLoading, decisionsRefreshKey])

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

  async function handleUpdateTaskInfo(
    taskId: string,
    title: string,
    description: string,
    deadline: string,
    priority: string,
  ): Promise<boolean> {
    if (!profileId) return false

    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setUpdateTaskInfoErrorMap((previous) => ({ ...previous, [taskId]: TASK_TITLE_REQUIRED_MESSAGE }))
      return false
    }

    let deadlineAt: string | null = null
    if (deadline) {
      const parsedDeadline = new Date(deadline)
      if (Number.isNaN(parsedDeadline.getTime())) {
        setUpdateTaskInfoErrorMap((previous) => ({ ...previous, [taskId]: 'Son tarih geçerli değil.' }))
        return false
      }
      deadlineAt = parsedDeadline.toISOString()
    }

    setUpdatingTaskInfoId(taskId)
    setUpdateTaskInfoErrorMap((previous) => {
      const next = { ...previous }
      delete next[taskId]
      return next
    })
    setTaskSuccessMessage(null)

    const { error } = await supabase
      .from('tasks')
      .update({
        title: trimmedTitle,
        description: description.trim() || null,
        deadline_at: deadlineAt,
        priority,
      })
      .eq('id', taskId)

    setUpdatingTaskInfoId(null)
    if (error) {
      setUpdateTaskInfoErrorMap((previous) => ({
        ...previous,
        [taskId]: 'Görev güncellenirken bir hata oluştu.',
      }))
      return false
    }

    setTaskSuccessMessage('Görev başarıyla güncellendi.')
    setTasksRefreshKey((current) => current + 1)
    return true
  }

  async function handleDeactivateTask(taskId: string) {
    if (!profileId || !isSuperAdmin) return
    if (!window.confirm('Bu görevi pasifleştirmek istediğinize emin misiniz?')) return

    setProcessingActiveStatusTaskId(taskId)
    const { error } = await supabase
      .from('tasks')
      .update({ deleted_at: new Date().toISOString(), deleted_by: profileId })
      .eq('id', taskId)

    setProcessingActiveStatusTaskId(null)
    if (error) {
      setTaskSuccessMessage('Görev pasifleştirilemedi.')
      return
    }
    setTasksRefreshKey((current) => current + 1)
  }

  async function handleReactivateTask(taskId: string) {
    if (!profileId || !isSuperAdmin) return

    setProcessingActiveStatusTaskId(taskId)
    const { error } = await supabase
      .from('tasks')
      .update({ deleted_at: null, deleted_by: null })
      .eq('id', taskId)

    setProcessingActiveStatusTaskId(null)
    if (error) {
      setTaskSuccessMessage('Görev yeniden aktifleştirilemedi.')
      return
    }
    setTasksRefreshKey((current) => current + 1)
  }

  async function handleAddDependency(
    taskId: string,
    payload: {
      dependencyType: string
      sourceEventId: string | null
      sourceTaskId: string | null
      requiredSksStatus: string | null
      requiredTaskProgressStatus: string | null
      offsetDays: number | null
    },
  ): Promise<boolean> {
    if (!profileId) return false

    setProcessingDependencyTaskId(taskId)
    setDependencyErrorMap((previous) => {
      const next = { ...previous }
      delete next[taskId]
      return next
    })

    const { error } = await supabase.from('task_dependencies').insert({
      task_id: taskId,
      dependency_type: payload.dependencyType,
      source_event_id: payload.sourceEventId,
      source_task_id: payload.sourceTaskId,
      required_sks_status: payload.requiredSksStatus,
      required_task_progress_status: payload.requiredTaskProgressStatus,
      offset_days: payload.offsetDays,
      created_by: profileId,
    })

    setProcessingDependencyTaskId(null)
    if (error) {
      setDependencyErrorMap((previous) => ({
        ...previous,
        [taskId]: 'Bağımlılık eklenirken bir hata oluştu.',
      }))
      return false
    }

    setTaskSuccessMessage('Bağımlılık başarıyla eklendi.')
    setTasksRefreshKey((current) => current + 1)
    return true
  }

  async function handleDeleteDependency(dependencyId: string): Promise<boolean> {
    const { error } = await supabase.from('task_dependencies').delete().eq('id', dependencyId)
    if (error) {
      setTaskSuccessMessage('Bağımlılık silinemedi.')
      return false
    }

    setTaskSuccessMessage('Bağımlılık başarıyla silindi.')
    setTasksRefreshKey((current) => current + 1)
    return true
  }

  function openCreateDecisionForm() {
    setDecisionFormMode('create')
    setEditingDecisionId(null)
    setDecisionTitle('')
    setDecisionText('')
    setDecisionDate('')
    setDecisionFormError(null)
    setDecisionSuccessMessage(null)
    setIsDecisionFormOpen(true)
  }

  function openEditDecisionForm(decision: EventDecision) {
    setDecisionFormMode('edit')
    setEditingDecisionId(decision.id)
    setDecisionTitle(decision.title)
    setDecisionText(decision.decisionText)
    setDecisionDate(extractDateOnly(decision.decidedAt))
    setDecisionFormError(null)
    setDecisionSuccessMessage(null)
    setIsDecisionFormOpen(true)
  }

  function closeDecisionForm() {
    setIsDecisionFormOpen(false)
    setDecisionFormError(null)
  }

  async function handleSaveDecision() {
    if (!eventId || !profileId) return
    setDecisionFormError(null)

    const tTitle = decisionTitle.trim()
    const tText = decisionText.trim()

    if (!tTitle || !tText) {
      setDecisionFormError('Başlık ve karar metni boş bırakılamaz.')
      return
    }

    setIsSavingDecision(true)
    const payload = {
      title: tTitle,
      decision_text: tText,
      decided_at: decisionDate || null,
    }

    let error
    if (decisionFormMode === 'create') {
      const res = await supabase.from('event_decisions').insert({
        event_id: eventId,
        created_by: profileId,
        ...payload,
      })
      error = res.error
    } else {
      const res = await supabase.from('event_decisions').update(payload).eq('id', editingDecisionId)
      error = res.error
    }

    setIsSavingDecision(false)

    if (error) {
      console.error('Karar kaydetme hatası:', error)
      if (error.message.includes('kilitli')) {
        setDecisionFormError('Dönem kilitli olduğu için bu işlemi gerçekleştiremezsiniz.')
      } else if (error.code === '42501') {
        setDecisionFormError('Bu etkinlik için karar ekleme yetkiniz bulunmuyor.')
      } else if (error.code === '23503') {
        setDecisionFormError('Etkinlik veya kullanıcı kaydı bulunamadı. Sayfayı yenileyip tekrar deneyin.')
      } else if (error.code === '42P01') {
        setDecisionFormError('Kararlar altyapısı henüz etkin değil. Teknik yöneticinin migration kontrolü yapması gerekiyor.')
      } else {
        setDecisionFormError(`Karar kaydedilemedi. Hata kodu: ${error.code ?? 'bilinmiyor'}`)
      }
      return
    }

    closeDecisionForm()
    setDecisionSuccessMessage(
      decisionFormMode === 'create' ? 'Karar başarıyla eklendi.' : 'Karar başarıyla güncellendi.'
    )
    setDecisionsRefreshKey((prev) => prev + 1)
  }

  async function handleDeactivateDecision(id: string) {
    if (!profileId) return
    if (!window.confirm('Bu kararı pasifleştirmek istediğinize emin misiniz?')) return

    setDeactivatingDecisionId(id)
    const { error } = await supabase
      .from('event_decisions')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: profileId,
        deletion_note: 'Karar pasifleştirildi',
      })
      .eq('id', id)

    setDeactivatingDecisionId(null)

    if (error) {
      if (error.message.includes('kilitli')) {
        alert('Dönem kilitli olduğu için karar pasifleştirilemedi.')
      } else {
        alert('Karar pasifleştirilemedi.')
      }
      return
    }

    setDecisionSuccessMessage('Karar pasifleştirildi.')
    setDecisionsRefreshKey((prev) => prev + 1)
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
  if (loadState === 'not_found' || !event || !eventId) return <CenteredMessage text="Etkinlik bulunamadı." />

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

        {/* Kararlar Bölümü */}
        <div className="mt-6 rounded-lg border border-canvas-border bg-canvas-surface p-6 shadow-card">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-semibold text-ink">Kararlar</h2>
            {canEdit && !isDecisionFormOpen && (
              <button
                type="button"
                onClick={openCreateDecisionForm}
                className="shrink-0 rounded-md border border-canvas-border bg-canvas px-3 py-1.5 text-sm font-medium text-ink hover:bg-canvas-surface"
              >
                Karar ekle
              </button>
            )}
          </div>

          {decisionSuccessMessage && !isDecisionFormOpen && (
            <p className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {decisionSuccessMessage}
            </p>
          )}

          {isDecisionFormOpen && (
            <div className="mt-4 rounded-md border border-canvas-border bg-canvas px-4 py-4">
              <h3 className="text-sm font-semibold text-ink">
                {decisionFormMode === 'create' ? 'Yeni karar' : 'Kararı düzenle'}
              </h3>
              <div className="mt-3 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label htmlFor="decision-title" className="text-sm font-medium text-ink-soft">
                    Karar başlığı
                  </label>
                  <input
                    id="decision-title"
                    type="text"
                    value={decisionTitle}
                    onChange={(e) => setDecisionTitle(e.target.value)}
                    disabled={isSavingDecision}
                    className="rounded-md border border-canvas-border bg-canvas-surface px-3 py-2 text-sm text-ink"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="decision-text" className="text-sm font-medium text-ink-soft">
                    Karar açıklaması
                  </label>
                  <textarea
                    id="decision-text"
                    value={decisionText}
                    onChange={(e) => setDecisionText(e.target.value)}
                    disabled={isSavingDecision}
                    rows={4}
                    className="rounded-md border border-canvas-border bg-canvas-surface px-3 py-2 text-sm text-ink"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="decision-date" className="text-sm font-medium text-ink-soft">
                      Karar tarihi
                    </label>
                    <input
                      id="decision-date"
                      type="date"
                      value={decisionDate}
                      onChange={(e) => setDecisionDate(e.target.value)}
                      disabled={isSavingDecision}
                      className="rounded-md border border-canvas-border bg-canvas-surface px-3 py-2 text-sm text-ink"
                    />
                  </div>
                </div>
                {decisionFormError && (
                  <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {decisionFormError}
                  </p>
                )}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void handleSaveDecision()}
                    disabled={isSavingDecision}
                    className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-canvas-surface disabled:opacity-60"
                  >
                    {isSavingDecision ? 'Kaydediliyor…' : 'Kaydet'}
                  </button>
                  <button
                    type="button"
                    onClick={closeDecisionForm}
                    disabled={isSavingDecision}
                    className="rounded-md border border-canvas-border px-4 py-2 text-sm font-medium text-ink-soft disabled:opacity-60"
                  >
                    İptal
                  </button>
                </div>
              </div>
            </div>
          )}

          {decisionsLoadState === 'loading' && (
            <p className="mt-3 text-sm text-ink-soft">Kararlar yükleniyor…</p>
          )}
          {decisionsLoadState === 'error' && (
            <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Kararlar yüklenirken bir hata oluştu.
            </p>
          )}
          {decisionsLoadState === 'ready' && decisions.length === 0 && (
            <p className="mt-3 text-sm italic text-ink-soft">Bu etkinlik için henüz karar eklenmemiş.</p>
          )}
          {decisionsLoadState === 'ready' && decisions.length > 0 && (
            <div className="mt-4 flex flex-col gap-4">
              {decisions.map((decision) => (
                <div key={decision.id} className="rounded-md border border-canvas-border bg-canvas px-4 py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-ink">{decision.title}</h4>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{decision.decisionText}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
                        <span>{formatDate(decision.decidedAt)}</span>
                        <span>{decision.creatorName}</span>
                      </div>
                    </div>
                    {canEdit && (
                      <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-2">
                        <button
                          type="button"
                          onClick={() => openEditDecisionForm(decision)}
                          className="text-xs font-medium text-ink-soft underline decoration-dotted"
                        >
                          Düzenle
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeactivateDecision(decision.id)}
                          disabled={deactivatingDecisionId === decision.id}
                          className="text-xs font-medium text-red-600 underline decoration-dotted disabled:opacity-50"
                        >
                          {deactivatingDecisionId === decision.id ? 'İşleniyor…' : 'Pasifleştir'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-sm font-semibold text-ink">Görevler</h2>
              {isSuperAdmin && (
                <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-soft">
                  <input
                    type="checkbox"
                    checked={showInactiveTasks}
                    onChange={(event) => setShowInactiveTasks(event.target.checked)}
                    className="rounded border-canvas-border text-ink focus:ring-ink"
                  />
                  Pasif görevleri göster
                </label>
              )}
            </div>
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
                    eventId={eventId ?? ''}
                    task={task}
                    allTasks={tasks}
                    isSuperAdmin={isSuperAdmin}
                    canEditTask={canEdit}
                    canManageAssignments={canEdit}
                    canUpdateStatus={canUpdateStatus}
                    isPanelOpen={openAssignmentTaskId === task.id}
                    onTogglePanel={() => toggleAssignmentPanel(task.id)}
                    members={periodMembers}
                    membersLoadState={periodMembersLoadState}
                    availableTaskStatuses={availableTaskStatuses}
                    availableSksStatuses={availableSksStatuses}
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
                    onUpdateTaskInfo={handleUpdateTaskInfo}
                    isUpdatingTaskInfo={updatingTaskInfoId === task.id}
                    updateTaskInfoError={updateTaskInfoErrorMap[task.id] ?? null}
                    onDeactivateTask={handleDeactivateTask}
                    onReactivateTask={handleReactivateTask}
                    isProcessingActiveStatus={processingActiveStatusTaskId === task.id}
                    onAddDependency={handleAddDependency}
                    onDeleteDependency={handleDeleteDependency}
                    isProcessingDependency={processingDependencyTaskId === task.id}
                    dependencyError={dependencyErrorMap[task.id] ?? null}
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
