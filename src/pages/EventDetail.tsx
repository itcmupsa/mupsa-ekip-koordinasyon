import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useSession } from '../hooks/useSession'
import { useMembershipStatus } from '../hooks/useMembershipStatus'
import { supabase } from '../lib/supabaseClient'

interface EventBasicInfo {
  title: string
  description: string | null
  eventStatus: string | null
  sksStatus: string | null
  budgetStatus: string | null
  estimatedBudget: number | null
  approvedBudget: number | null
  actualExpense: number | null
  budgetNote: string | null
  planningDate: string | null
  preparationStartDate: string | null
  estimatedDate: string | null
  confirmedDate: string | null
  ownerId: string | null
  venue: string | null
  nextAction: string | null
  generalNote: string | null
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
  deletedAt: string | null
}

interface EventReport {
  id: string
  title: string
  reportText: string
  reportDate: string | null
  createdBy: string
  creatorName: string | null
  createdAt: string
  deletedAt: string | null
}

interface EventLink {
  id: string
  title: string
  url: string
  description: string | null
  createdBy: string
  creatorName: string | null
  createdAt: string
  deletedAt: string | null
}

interface EventFile {
  id: string
  storagePath: string
  originalFileName: string
  mimeType: string
  fileSizeBytes: number
  uploadedBy: string
  uploaderName: string | null
  createdAt: string
  deletedAt: string | null
}

interface EventProcessMemberInfo {
  id: string
  profileId: string
  displayName: string
  responsibilityType: string
  processType: string
}

interface EventBudgetSponsor {
  id: string
  eventId: string
  sponsorName: string
  amount: number
  note: string | null
  createdBy: string
  creatorName: string | null
  createdAt: string
  deletedAt: string | null
}

type TasksLoadState = 'loading' | 'ready' | 'error'

interface PeriodMemberOption {
  profileId: string
  displayName: string
  coordinatorRoleSlug: string | null
}

interface TaskProgressStatusOption {
  slug: string
  label: string
}

interface SksStatusOption {
  slug: string
  label: string
}

interface BudgetStatusOption {
  slug: string
  label: string
}

type PeriodMembersLoadState = 'idle' | 'loading' | 'ready' | 'error'
type DecisionsLoadState = 'idle' | 'loading' | 'ready' | 'error'
type ReportsLoadState = 'idle' | 'loading' | 'ready' | 'error'
type LinksLoadState = 'idle' | 'loading' | 'ready' | 'error'
type FilesLoadState = 'idle' | 'loading' | 'ready' | 'error'

const NOT_SPECIFIED = 'Henüz belirtilmedi'
const EVENT_FILES_BUCKET = 'event-files'
const MAX_EVENT_FILE_SIZE_BYTES = 5242880
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
  })
}

function formatCurrency(value: number | null): string {
  if (value === null) return NOT_SPECIFIED
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value) + ' ₺'
}

function parseNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function DetailRow({ label, value, isMultiline = false }: { label: string; value: string; isMultiline?: boolean }) {
  return (
    <div className={`flex flex-col gap-1 py-2 ${isMultiline ? '' : 'sm:flex-row sm:items-center sm:justify-between'}`}>
      <span className="text-sm font-medium text-ink-soft">{label}</span>
      <span className={`text-sm text-ink ${isMultiline ? 'whitespace-pre-wrap mt-1' : ''}`}>{value}</span>
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
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateTimeLocal(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return 'Bilinmiyor'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function sanitizeFileName(rawName: string): string {
  const trimmed = rawName.trim()
  // eslint-disable-next-line no-control-regex
  const withoutControlChars = trimmed.replace(/[/\\\x00-\x1F\x7F]/g, '')
  const safe = withoutControlChars.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/_+/g, '_').replace(/^[_.]+|[_.]+$/g, '')
  const finalName = safe.length > 0 ? safe : 'dosya'
  return finalName.slice(0, 150)
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
  const [availableBudgetStatuses, setAvailableBudgetStatuses] = useState<BudgetStatusOption[]>([])
  const [processingDependencyTaskId, setProcessingDependencyTaskId] = useState<string | null>(null)
  const [dependencyErrorMap, setDependencyErrorMap] = useState<Record<string, string>>({})

  // Process Teams State (Combined fetch)
  const [processMembers, setProcessMembers] = useState<EventProcessMemberInfo[]>([])
  const [processMembersLoadState, setProcessMembersLoadState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [processMembersRefreshKey, setProcessMembersRefreshKey] = useState(0)

  // SKS State
  const [isSksPanelOpen, setIsSksPanelOpen] = useState(false)
  const [sksSelectedProfileId, setSksSelectedProfileId] = useState('')
  const [sksSelectedResponsibility, setSksSelectedResponsibility] = useState('supporting')
  const [isAssigningSks, setIsAssigningSks] = useState(false)
  const [assignSksError, setAssignSksError] = useState<string | null>(null)
  const [removingSksMemberId, setRemovingSksMemberId] = useState<string | null>(null)
  const [removeSksError, setRemoveSksError] = useState<string | null>(null)
  const [isUpdatingSksStatus, setIsUpdatingSksStatus] = useState(false)
  const [updateSksStatusError, setUpdateSksStatusError] = useState<string | null>(null)
  const [updateSksStatusSuccess, setUpdateSksStatusSuccess] = useState<string | null>(null)

  // Budget State
  const [isBudgetPanelOpen, setIsBudgetPanelOpen] = useState(false)
  const [budgetSelectedProfileId, setBudgetSelectedProfileId] = useState('')
  const [budgetSelectedResponsibility, setBudgetSelectedResponsibility] = useState('supporting')
  const [isAssigningBudget, setIsAssigningBudget] = useState(false)
  const [assignBudgetError, setAssignBudgetError] = useState<string | null>(null)
  const [removingBudgetMemberId, setRemovingBudgetMemberId] = useState<string | null>(null)
  const [removeBudgetError, setRemoveBudgetError] = useState<string | null>(null)

  const [isEditingBudget, setIsEditingBudget] = useState(false)
  const [editBudgetStatus, setEditBudgetStatus] = useState('')
  const [editEstimatedBudget, setEditEstimatedBudget] = useState<string>('')
  const [editApprovedBudget, setEditApprovedBudget] = useState<string>('')
  const [editActualExpense, setEditActualExpense] = useState<string>('')
  const [editBudgetNote, setEditBudgetNote] = useState('')
  const [isSavingBudget, setIsSavingBudget] = useState(false)
  const [budgetSaveError, setBudgetSaveError] = useState<string | null>(null)
  const [budgetSaveSuccess, setBudgetSaveSuccess] = useState<string | null>(null)

  // Sponsors State
  const [sponsorsLoadState, setSponsorsLoadState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [sponsors, setSponsors] = useState<EventBudgetSponsor[]>([])
  const [sponsorsRefreshKey, setSponsorsRefreshKey] = useState(0)
  const [showInactiveSponsors, setShowInactiveSponsors] = useState(false)
  const [isSponsorFormOpen, setIsSponsorFormOpen] = useState(false)
  const [sponsorFormMode, setSponsorFormMode] = useState<'create' | 'edit'>('create')
  const [editingSponsorId, setEditingSponsorId] = useState<string | null>(null)
  const [sponsorName, setSponsorName] = useState('')
  const [sponsorAmount, setSponsorAmount] = useState<string>('')
  const [sponsorNote, setSponsorNote] = useState('')
  const [isSavingSponsor, setIsSavingSponsor] = useState(false)
  const [sponsorFormError, setSponsorFormError] = useState<string | null>(null)
  const [sponsorSuccessMessage, setSponsorSuccessMessage] = useState<string | null>(null)
  const [deactivatingSponsorId, setDeactivatingSponsorId] = useState<string | null>(null)

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
  const [showInactiveDecisions, setShowInactiveDecisions] = useState(false)

  // Reports State
  const [reportsLoadState, setReportsLoadState] = useState<ReportsLoadState>('idle')
  const [reports, setReports] = useState<EventReport[]>([])
  const [reportsRefreshKey, setReportsRefreshKey] = useState(0)
  const [isReportFormOpen, setIsReportFormOpen] = useState(false)
  const [reportFormMode, setReportFormMode] = useState<'create' | 'edit'>('create')
  const [editingReportId, setEditingReportId] = useState<string | null>(null)
  const [reportTitle, setReportTitle] = useState('')
  const [reportText, setReportText] = useState('')
  const [reportDate, setReportDate] = useState('')
  const [isSavingReport, setIsSavingReport] = useState(false)
  const [reportFormError, setReportFormError] = useState<string | null>(null)
  const [reportSuccessMessage, setReportSuccessMessage] = useState<string | null>(null)
  const [deactivatingReportId, setDeactivatingReportId] = useState<string | null>(null)
  const [showInactiveReports, setShowInactiveReports] = useState(false)

  // Links State
  const [linksLoadState, setLinksLoadState] = useState<LinksLoadState>('idle')
  const [links, setLinks] = useState<EventLink[]>([])
  const [linksRefreshKey, setLinksRefreshKey] = useState(0)
  const [showInactiveLinks, setShowInactiveLinks] = useState(false)
  const [isLinkFormOpen, setIsLinkFormOpen] = useState(false)
  const [linkFormMode, setLinkFormMode] = useState<'create' | 'edit'>('create')
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null)
  const [linkTitle, setLinkTitle] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkDescription, setLinkDescription] = useState('')
  const [isSavingLink, setIsSavingLink] = useState(false)
  const [linkFormError, setLinkFormError] = useState<string | null>(null)
  const [linkSuccessMessage, setLinkSuccessMessage] = useState<string | null>(null)
  const [deactivatingLinkId, setDeactivatingLinkId] = useState<string | null>(null)

  // Files State
  const [filesLoadState, setFilesLoadState] = useState<FilesLoadState>('idle')
  const [files, setFiles] = useState<EventFile[]>([])
  const [filesRefreshKey, setFilesRefreshKey] = useState(0)
  const [showInactiveFiles, setShowInactiveFiles] = useState(false)
  const [isFileFormOpen, setIsFileFormOpen] = useState(false)
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null)
  const [isUploadingFile, setIsUploadingFile] = useState(false)
  const [fileFormError, setFileFormError] = useState<string | null>(null)
  const [fileSuccessMessage, setFileSuccessMessage] = useState<string | null>(null)
  const [deactivatingFileId, setDeactivatingFileId] = useState<string | null>(null)
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null)
  const [downloadErrorMap, setDownloadErrorMap] = useState<Record<string, string>>({})

  const [isEditingGeneralNote, setIsEditingGeneralNote] = useState(false)
  const [generalNoteInputValue, setGeneralNoteInputValue] = useState('')
  const [isSavingGeneralNote, setIsSavingGeneralNote] = useState(false)
  const [generalNoteError, setGeneralNoteError] = useState<string | null>(null)
  const [generalNoteSuccess, setGeneralNoteSuccess] = useState<string | null>(null)

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
          'title, description, event_status, sks_status, budget_status, estimated_budget, approved_budget, actual_expense, budget_note, planning_date, preparation_start_date, estimated_date, confirmed_date, owner_id, venue, next_action, general_note',
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
        sksStatus: (data.sks_status as string | null) ?? null,
        budgetStatus: (data.budget_status as string | null) ?? null,
        estimatedBudget: parseNullableNumber(data.estimated_budget),
        approvedBudget: parseNullableNumber(data.approved_budget),
        actualExpense: parseNullableNumber(data.actual_expense),
        budgetNote: (data.budget_note as string | null) ?? null,
        planningDate: (data.planning_date as string | null) ?? null,
        preparationStartDate: (data.preparation_start_date as string | null) ?? null,
        estimatedDate: (data.estimated_date as string | null) ?? null,
        confirmedDate: (data.confirmed_date as string | null) ?? null,
        ownerId,
        venue: (data.venue as string | null) ?? null,
        nextAction: (data.next_action as string | null) ?? null,
        generalNote: (data.general_note as string | null) ?? null,
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
    if (statusLoading || !hasActiveMembership || !eventId) return
    let isMounted = true

    async function loadProcessMembers() {
      setProcessMembersLoadState('loading')
      const { data: memberRows, error } = await supabase
        .from('event_process_members')
        .select('id, profile_id, responsibility_type, process_type')
        .eq('event_id', eventId)

      if (!isMounted) return
      if (error) {
        setProcessMembersLoadState('error')
        return
      }

      const profileIds = Array.from(new Set((memberRows ?? []).map((row) => row.profile_id as string)))
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

      setProcessMembers((memberRows ?? []).map((row) => ({
        id: row.id as string,
        profileId: row.profile_id as string,
        displayName: profileNameMap[row.profile_id as string] || 'İsimsiz üye',
        responsibilityType: row.responsibility_type as string,
        processType: row.process_type as string
      })))
      setProcessMembersLoadState('ready')
    }

    void loadProcessMembers()
    return () => {
      isMounted = false
    }
  }, [hasActiveMembership, eventId, statusLoading, processMembersRefreshKey])

  useEffect(() => {
    if (!isEditingGeneralNote && event) {
      setGeneralNoteInputValue(event.generalNote ?? '')
    }
  }, [event, isEditingGeneralNote])

  useEffect(() => {
    if (statusLoading || !hasActiveMembership) return
    let isMounted = true

    async function loadReferenceData() {
      const [{ data: taskData }, { data: sksData }, { data: budgetData }] = await Promise.all([
        supabase.from('task_progress_statuses').select('slug, label').order('sort_order', { ascending: true }),
        supabase.from('sks_statuses').select('slug, label').order('sort_order', { ascending: true }),
        supabase.from('budget_statuses').select('slug, label').order('sort_order', { ascending: true })
      ])

      if (!isMounted) return
      setAvailableTaskStatuses((taskData ?? []) as TaskProgressStatusOption[])
      setAvailableSksStatuses((sksData ?? []) as SksStatusOption[])
      setAvailableBudgetStatuses((budgetData ?? []) as BudgetStatusOption[])
    }

    void loadReferenceData()
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
      let decisionsQuery = supabase
        .from('event_decisions')
        .select('id, title, decision_text, decided_at, created_by, created_at, deleted_at')
        .eq('event_id', eventId)
        .order('decided_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
      if (!showInactiveDecisions) {
        decisionsQuery = decisionsQuery.is('deleted_at', null)
      }
      const { data, error } = await decisionsQuery

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
          deletedAt: (row.deleted_at as string | null) ?? null,
        }))
      )
      setDecisionsLoadState('ready')
    }

    void loadDecisions()
    return () => {
      isMounted = false
    }
  }, [hasActiveMembership, eventId, statusLoading, decisionsRefreshKey, showInactiveDecisions])

  useEffect(() => {
    if (statusLoading || !hasActiveMembership || !eventId) return
    let isMounted = true

    async function loadReports() {
      setReportsLoadState('loading')
      let reportsQuery = supabase
        .from('event_reports')
        .select('id, title, report_text, report_date, created_by, created_at, deleted_at')
        .eq('event_id', eventId)
        .order('report_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
      if (!showInactiveReports) {
        reportsQuery = reportsQuery.is('deleted_at', null)
      }
      const { data, error } = await reportsQuery

      if (!isMounted) return
      if (error) {
        setReportsLoadState('error')
        return
      }

      const creatorIds = Array.from(new Set((data ?? []).map((r) => r.created_by)))
      const profileMap: Record<string, string> = {}
      if (creatorIds.length > 0) {
        const { data: profilesData } = await supabase.from('profiles').select('id, display_name').in('id', creatorIds)
        if (profilesData) {
          for (const p of profilesData) {
            profileMap[p.id] = p.display_name
          }
        }
      }

      setReports(
        (data ?? []).map((row) => ({
          id: row.id as string,
          title: row.title as string,
          reportText: row.report_text as string,
          reportDate: (row.report_date as string | null) ?? null,
          createdBy: row.created_by as string,
          creatorName: profileMap[row.created_by as string] || 'Bilinmeyen Kullanıcı',
          createdAt: row.created_at as string,
          deletedAt: (row.deleted_at as string | null) ?? null,
        }))
      )
      setReportsLoadState('ready')
    }

    void loadReports()
    return () => {
      isMounted = false
    }
  }, [hasActiveMembership, eventId, statusLoading, reportsRefreshKey, showInactiveReports])

  useEffect(() => {
    if (statusLoading || !hasActiveMembership || !eventId) return
    let isMounted = true

    async function loadLinks() {
      setLinksLoadState('loading')
      let linksQuery = supabase
        .from('event_links')
        .select('id, title, url, description, created_by, created_at, deleted_at')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })

      if (!showInactiveLinks) {
        linksQuery = linksQuery.is('deleted_at', null)
      }
      const { data, error } = await linksQuery

      if (!isMounted) return
      if (error) {
        setLinksLoadState('error')
        return
      }

      const creatorIds = Array.from(new Set((data ?? []).map((l) => l.created_by)))
      const profileMap: Record<string, string> = {}
      if (creatorIds.length > 0) {
        const { data: profilesData } = await supabase.from('profiles').select('id, display_name').in('id', creatorIds)
        if (profilesData) {
          for (const p of profilesData) {
            profileMap[p.id] = p.display_name
          }
        }
      }

      setLinks(
        (data ?? []).map((row) => ({
          id: row.id as string,
          title: row.title as string,
          url: row.url as string,
          description: (row.description as string | null) ?? null,
          createdBy: row.created_by as string,
          creatorName: profileMap[row.created_by as string] || 'Bilinmeyen Kullanıcı',
          createdAt: row.created_at as string,
          deletedAt: (row.deleted_at as string | null) ?? null,
        }))
      )
      setLinksLoadState('ready')
    }

    void loadLinks()
    return () => {
      isMounted = false
    }
  }, [hasActiveMembership, eventId, statusLoading, linksRefreshKey, showInactiveLinks])

  useEffect(() => {
    if (statusLoading || !hasActiveMembership || !eventId) return
    let isMounted = true

    async function loadFiles() {
      setFilesLoadState('loading')
      let filesQuery = supabase
        .from('event_files')
        .select('id, storage_path, original_file_name, mime_type, file_size_bytes, uploaded_by, created_at, deleted_at')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })

      if (!showInactiveFiles) {
        filesQuery = filesQuery.is('deleted_at', null)
      }
      const { data, error } = await filesQuery

      if (!isMounted) return
      if (error) {
        setFilesLoadState('error')
        return
      }

      const uploaderIds = Array.from(new Set((data ?? []).map((f) => f.uploaded_by)))
      const profileMap: Record<string, string> = {}
      if (uploaderIds.length > 0) {
        const { data: profilesData } = await supabase.from('profiles').select('id, display_name').in('id', uploaderIds)
        if (profilesData) {
          for (const p of profilesData) {
            profileMap[p.id] = p.display_name
          }
        }
      }

      setFiles(
        (data ?? []).map((row) => ({
          id: row.id as string,
          storagePath: row.storage_path as string,
          originalFileName: row.original_file_name as string,
          mimeType: row.mime_type as string,
          fileSizeBytes: row.file_size_bytes as number,
          uploadedBy: row.uploaded_by as string,
          uploaderName: profileMap[row.uploaded_by as string] || 'Bilinmeyen Kullanıcı',
          createdAt: row.created_at as string,
          deletedAt: (row.deleted_at as string | null) ?? null,
        }))
      )
      setFilesLoadState('ready')
    }

    void loadFiles()
    return () => {
      isMounted = false
    }
  }, [hasActiveMembership, eventId, statusLoading, filesRefreshKey, showInactiveFiles])

  useEffect(() => {
    if (statusLoading || !hasActiveMembership || !eventId) return
    const targetEventId = eventId
    let isMounted = true

    async function loadSponsors() {
      setSponsorsLoadState('loading')
      let query = supabase
        .from('event_budget_sponsors')
        .select('id, sponsor_name, amount, note, created_by, created_at, deleted_at')
        .eq('event_id', targetEventId)
        .order('created_at', { ascending: false })

      if (!showInactiveSponsors) {
        query = query.is('deleted_at', null)
      }
      const { data, error } = await query

      if (!isMounted) return
      if (error) {
        setSponsorsLoadState('error')
        return
      }

      const creatorIds = Array.from(new Set((data ?? []).map((s) => s.created_by)))
      const profileMap: Record<string, string> = {}
      if (creatorIds.length > 0) {
        const { data: profilesData } = await supabase.from('profiles').select('id, display_name').in('id', creatorIds)
        if (profilesData) {
          for (const p of profilesData) {
            profileMap[p.id] = p.display_name
          }
        }
      }

      setSponsors(
        (data ?? []).map((row) => ({
          id: row.id as string,
          eventId: targetEventId,
          sponsorName: row.sponsor_name as string,
          amount: parseNullableNumber(row.amount) ?? 0,
          note: (row.note as string | null) ?? null,
          createdBy: row.created_by as string,
          creatorName: profileMap[row.created_by as string] || 'Bilinmeyen Kullanıcı',
          createdAt: row.created_at as string,
          deletedAt: (row.deleted_at as string | null) ?? null,
        }))
      )
      setSponsorsLoadState('ready')
    }

    void loadSponsors()
    return () => {
      isMounted = false
    }
  }, [hasActiveMembership, eventId, statusLoading, sponsorsRefreshKey, showInactiveSponsors])

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
    setDecisionDate(new Date().toISOString().slice(0, 10))
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
      ...(decisionDate ? { decided_at: decisionDate } : {}),
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
      } else if (error.code === '23502') {
        setDecisionFormError('Karar tarihi boş kaldı. Tarihi seçip tekrar deneyin.')
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

  async function handleReactivateDecision(id: string) {
    if (!profileId || !canEdit) return

    setDeactivatingDecisionId(id)
    const { error } = await supabase
      .from('event_decisions')
      .update({ deleted_at: null, deleted_by: null, deletion_note: null })
      .eq('id', id)

    setDeactivatingDecisionId(null)

    if (error) {
      if (error.message.includes('kilitli')) {
        alert('Dönem kilitli olduğu için karar yeniden aktifleştirilemedi.')
      } else {
        alert('Karar yeniden aktifleştirilemedi.')
      }
      return
    }

    setDecisionSuccessMessage('Karar yeniden aktifleştirildi.')
    setDecisionsRefreshKey((prev) => prev + 1)
  }

  function openCreateReportForm() {
    setReportFormMode('create')
    setEditingReportId(null)
    setReportTitle('')
    setReportText('')
    setReportDate(new Date().toISOString().slice(0, 10))
    setReportFormError(null)
    setReportSuccessMessage(null)
    setIsReportFormOpen(true)
  }

  function openEditReportForm(report: EventReport) {
    setReportFormMode('edit')
    setEditingReportId(report.id)
    setReportTitle(report.title)
    setReportText(report.reportText)
    setReportDate(extractDateOnly(report.reportDate))
    setReportFormError(null)
    setReportSuccessMessage(null)
    setIsReportFormOpen(true)
  }

  function closeReportForm() {
    setIsReportFormOpen(false)
    setReportFormError(null)
  }

  async function handleSaveReport() {
    if (!eventId || !profileId || !canEdit) return
    setReportFormError(null)

    const tTitle = reportTitle.trim()
    const tText = reportText.trim()

    if (!tTitle || !tText || !reportDate) {
      setReportFormError('Rapor başlığı, metni ve tarihi boş bırakılamaz.')
      return
    }

    if (reportFormMode === 'edit' && !editingReportId) {
      setReportFormError('Düzenlenecek rapor bulunamadı. Formu kapatıp tekrar deneyin.')
      return
    }

    setIsSavingReport(true)
    const payload = {
      title: tTitle,
      report_text: tText,
      report_date: reportDate,
    }

    let error
    if (reportFormMode === 'create') {
      const res = await supabase.from('event_reports').insert({
        event_id: eventId,
        created_by: profileId,
        ...payload,
      })
      error = res.error
    } else {
      const res = await supabase.from('event_reports').update(payload).eq('id', editingReportId)
      error = res.error
    }

    setIsSavingReport(false)

    if (error) {
      console.error('Rapor kaydetme hatası:', error)
      if (error.message.includes('kilitli')) {
        setReportFormError('Dönem kilitli olduğu için bu işlemi gerçekleştiremezsiniz.')
      } else if (error.code === '42501') {
        setReportFormError('Bu etkinlik için rapor ekleme yetkiniz bulunmuyor.')
      } else if (error.code === '23503') {
        setReportFormError('Etkinlik veya kullanıcı kaydı bulunamadı. Sayfayı yenileyip tekrar deneyin.')
      } else if (error.code === '23502') {
        setReportFormError('Rapor tarihi boş kaldı. Tarihi seçip tekrar deneyin.')
      } else if (error.code === '42P01') {
        setReportFormError('Raporlar altyapısı henüz etkin değil. Teknik yöneticinin migration kontrolü yapması gerekiyor.')
      } else {
        setReportFormError(`Rapor kaydedilemedi. Hata kodu: ${error.code ?? 'bilinmiyor'}`)
      }
      return
    }

    closeReportForm()
    setReportSuccessMessage(
      reportFormMode === 'create' ? 'Rapor başarıyla eklendi.' : 'Rapor başarıyla güncellendi.'
    )
    setReportsRefreshKey((prev) => prev + 1)
  }

  async function handleDeactivateReport(id: string) {
    if (!profileId || !canEdit) return
    if (!window.confirm('Bu raporu pasifleştirmek istediğinize emin misiniz?')) return

    setDeactivatingReportId(id)
    const { error } = await supabase
      .from('event_reports')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: profileId,
        deletion_note: 'Rapor pasifleştirildi',
      })
      .eq('id', id)

    setDeactivatingReportId(null)

    if (error) {
      if (error.message.includes('kilitli')) {
        alert('Dönem kilitli olduğu için rapor pasifleştirilemedi.')
      } else {
        alert('Rapor pasifleştirilemedi.')
      }
      return
    }

    setReportSuccessMessage('Rapor pasifleştirildi.')
    setReportsRefreshKey((prev) => prev + 1)
  }

  async function handleReactivateReport(id: string) {
    if (!profileId || !canEdit) return

    setDeactivatingReportId(id)
    const { error } = await supabase
      .from('event_reports')
      .update({ deleted_at: null, deleted_by: null, deletion_note: null })
      .eq('id', id)

    setDeactivatingReportId(null)

    if (error) {
      if (error.message.includes('kilitli')) {
        alert('Dönem kilitli olduğu için rapor yeniden aktifleştirilemedi.')
      } else {
        alert('Rapor yeniden aktifleştirilemedi.')
      }
      return
    }

    setReportSuccessMessage('Rapor yeniden aktifleştirildi.')
    setReportsRefreshKey((prev) => prev + 1)
  }

  function openCreateLinkForm() {
    setLinkFormMode('create')
    setEditingLinkId(null)
    setLinkTitle('')
    setLinkUrl('')
    setLinkDescription('')
    setLinkFormError(null)
    setLinkSuccessMessage(null)
    setIsLinkFormOpen(true)
  }

  function openEditLinkForm(link: EventLink) {
    setLinkFormMode('edit')
    setEditingLinkId(link.id)
    setLinkTitle(link.title)
    setLinkUrl(link.url)
    setLinkDescription(link.description ?? '')
    setLinkFormError(null)
    setLinkSuccessMessage(null)
    setIsLinkFormOpen(true)
  }

  function closeLinkForm() {
    setIsLinkFormOpen(false)
    setLinkFormError(null)
  }

  async function handleSaveLink() {
    if (!eventId || !profileId || !canEdit) return
    setLinkFormError(null)

    const tTitle = linkTitle.trim()
    const tUrl = linkUrl.trim()
    const tDescription = linkDescription.trim()

    if (!tTitle || !tUrl) {
      setLinkFormError('Bağlantı başlığı ve URL boş bırakılamaz.')
      return
    }

    if (!tUrl.startsWith('http://') && !tUrl.startsWith('https://')) {
      setLinkFormError('URL adresi http:// veya https:// ile başlamalıdır.')
      return
    }

    if (linkFormMode === 'edit' && !editingLinkId) {
      setLinkFormError('Düzenlenecek bağlantı bulunamadı. Formu kapatıp tekrar deneyin.')
      return
    }

    setIsSavingLink(true)
    const payload = {
      title: tTitle,
      url: tUrl,
      description: tDescription.length > 0 ? tDescription : null,
    }

    let error
    if (linkFormMode === 'create') {
      const res = await supabase.from('event_links').insert({
        event_id: eventId,
        created_by: profileId,
        ...payload,
      })
      error = res.error
    } else {
      const res = await supabase.from('event_links').update(payload).eq('id', editingLinkId)
      error = res.error
    }

    setIsSavingLink(false)

    if (error) {
      console.error('Bağlantı kaydetme hatası:', error)
      if (error.message.includes('kilitli')) {
        setLinkFormError('Dönem kilitli olduğu için bu işlemi gerçekleştiremezsiniz.')
      } else if (error.code === '42501') {
        setLinkFormError('Bu etkinlik için bağlantı ekleme yetkiniz bulunmuyor.')
      } else {
        setLinkFormError('Bağlantı kaydedilirken bir hata oluştu.')
      }
      return
    }

    closeLinkForm()
    setLinkSuccessMessage(linkFormMode === 'create' ? 'Bağlantı başarıyla eklendi.' : 'Bağlantı başarıyla güncellendi.')
    setLinksRefreshKey((prev) => prev + 1)
  }

  async function handleDeactivateLink(id: string) {
    if (!profileId || !canEdit) return
    if (!window.confirm('Bu bağlantıyı pasifleştirmek istediğinize emin misiniz?')) return

    setDeactivatingLinkId(id)
    const { error } = await supabase
      .from('event_links')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: profileId,
        deletion_note: 'Bağlantı pasifleştirildi',
      })
      .eq('id', id)

    setDeactivatingLinkId(null)

    if (error) {
      if (error.message.includes('kilitli')) {
        alert('Dönem kilitli olduğu için bağlantı pasifleştirilemedi.')
      } else {
        alert('Bağlantı pasifleştirilemedi.')
      }
      return
    }

    setLinkSuccessMessage('Bağlantı pasifleştirildi.')
    setLinksRefreshKey((prev) => prev + 1)
  }

  async function handleReactivateLink(id: string) {
    if (!profileId || !canEdit) return

    setDeactivatingLinkId(id)
    const { error } = await supabase
      .from('event_links')
      .update({ deleted_at: null, deleted_by: null, deletion_note: null })
      .eq('id', id)

    setDeactivatingLinkId(null)

    if (error) {
      if (error.message.includes('kilitli')) {
        alert('Dönem kilitli olduğu için bağlantı yeniden aktifleştirilemedi.')
      } else {
        alert('Bağlantı yeniden aktifleştirilemedi.')
      }
      return
    }

    setLinkSuccessMessage('Bağlantı yeniden aktifleştirildi.')
    setLinksRefreshKey((prev) => prev + 1)
  }

  function openFileUploadForm() {
    setSelectedUploadFile(null)
    setFileFormError(null)
    setFileSuccessMessage(null)
    setIsFileFormOpen(true)
  }

  function closeFileUploadForm() {
    setIsFileFormOpen(false)
    setFileFormError(null)
    setSelectedUploadFile(null)
  }

  async function handleUploadFile() {
    if (!eventId || !profileId || !canEdit) return
    setFileFormError(null)

    if (!selectedUploadFile) {
      setFileFormError('Lütfen bir dosya seçin.')
      return
    }
    if (selectedUploadFile.size <= 0) {
      setFileFormError('Seçilen dosya boş görünüyor.')
      return
    }
    if (selectedUploadFile.size > MAX_EVENT_FILE_SIZE_BYTES) {
      setFileFormError('Dosya boyutu 5 MB sınırını aşıyor. Lütfen daha küçük bir dosya seçin.')
      return
    }

    setIsUploadingFile(true)

    const safeFileName = sanitizeFileName(selectedUploadFile.name)
    const uniqueId = crypto.randomUUID()
    const storagePath = `events/${eventId}/${uniqueId}-${safeFileName}`

    const { data: insertedRow, error: insertError } = await supabase
      .from('event_files')
      .insert({
        event_id: eventId,
        storage_path: storagePath,
        original_file_name: selectedUploadFile.name,
        mime_type: selectedUploadFile.type || 'application/octet-stream',
        file_size_bytes: selectedUploadFile.size,
        uploaded_by: profileId,
      })
      .select('id')
      .single()

    if (insertError || !insertedRow) {
      setIsUploadingFile(false)
      console.error('Dosya metadata kaydı oluşturma hatası:', insertError)
      if (insertError?.message.includes('kilitli')) {
        setFileFormError('Dönem kilitli olduğu için bu işlemi gerçekleştiremezsiniz.')
      } else if (insertError?.code === '42501') {
        setFileFormError('Bu etkinlik için dosya ekleme yetkiniz bulunmuyor.')
      } else {
        setFileFormError('Dosya kaydı oluşturulurken bir hata oluştu. Dosya yüklenmedi.')
      }
      return
    }

    const insertedFileId = insertedRow.id as string

    const { error: uploadError } = await supabase.storage
      .from(EVENT_FILES_BUCKET)
      .upload(storagePath, selectedUploadFile, {
        contentType: selectedUploadFile.type || 'application/octet-stream',
        upsert: false,
      })

    setIsUploadingFile(false)

    if (uploadError) {
      console.error('Storage yükleme hatası:', uploadError)
      const { error: cleanupError } = await supabase
        .from('event_files')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: profileId,
          deletion_note: 'Depolamaya yükleme başarısız olduğu için otomatik pasifleştirildi.',
        })
        .eq('id', insertedFileId)

      if (cleanupError) {
        console.error('Başarısız yükleme sonrası metadata temizleme hatası:', cleanupError)
        setFileFormError(
          'Dosya depolamaya yüklenemedi ve oluşturulan kayıt otomatik olarak pasifleştirilemedi. Lütfen bir yöneticiye bildirin.'
        )
      } else {
        setFileFormError('Dosya depolamaya yüklenemedi. Oluşturulan kayıt otomatik olarak pasifleştirildi.')
      }
      setFilesRefreshKey((prev) => prev + 1)
      return
    }

    closeFileUploadForm()
    setFileSuccessMessage('Dosya başarıyla yüklendi.')
    setFilesRefreshKey((prev) => prev + 1)
  }

  async function handleDeactivateFile(id: string) {
    if (!profileId || !canEdit) return
    if (!window.confirm('Bu dosyayı pasifleştirmek istediğinize emin misiniz?')) return

    setDeactivatingFileId(id)
    const { error } = await supabase
      .from('event_files')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: profileId,
        deletion_note: 'Dosya pasifleştirildi',
      })
      .eq('id', id)

    setDeactivatingFileId(null)

    if (error) {
      if (error.message.includes('kilitli')) {
        alert('Dönem kilitli olduğu için dosya pasifleştirilemedi.')
      } else {
        alert('Dosya pasifleştirilemedi.')
      }
      return
    }

    setFileSuccessMessage('Dosya pasifleştirildi.')
    setFilesRefreshKey((prev) => prev + 1)
  }

  async function handleReactivateFile(id: string) {
    if (!profileId || !canEdit) return

    setDeactivatingFileId(id)
    const { error } = await supabase
      .from('event_files')
      .update({ deleted_at: null, deleted_by: null, deletion_note: null })
      .eq('id', id)

    setDeactivatingFileId(null)

    if (error) {
      if (error.message.includes('kilitli')) {
        alert('Dönem kilitli olduğu için dosya yeniden aktifleştirilemedi.')
      } else {
        alert('Dosya yeniden aktifleştirilemedi.')
      }
      return
    }

    setFileSuccessMessage('Dosya yeniden aktifleştirildi.')
    setFilesRefreshKey((prev) => prev + 1)
  }

  async function handleDownloadFile(file: EventFile) {
    if (downloadingFileId) return
    setDownloadingFileId(file.id)
    setDownloadErrorMap((prev) => {
      const next = { ...prev }
      delete next[file.id]
      return next
    })

    const { data, error } = await supabase.storage.from(EVENT_FILES_BUCKET).download(file.storagePath)

    setDownloadingFileId(null)

    if (error || !data) {
      setDownloadErrorMap((prev) => ({
        ...prev,
        [file.id]: 'Dosya indirilemedi. Yetkiniz olmayabilir veya dosya bulunamadı.',
      }))
      return
    }

    const objectUrl = URL.createObjectURL(data)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = file.originalFileName
    anchor.rel = 'noopener'
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30000)
  }

  async function handleSaveGeneralNote() {
    if (!eventId || !periodId || !canEdit) return

    setGeneralNoteError(null)
    setIsSavingGeneralNote(true)
    const trimmedNote = generalNoteInputValue.trim()
    const finalNote = trimmedNote.length > 0 ? trimmedNote : null

    const { error } = await supabase
      .from('events')
      .update({ general_note: finalNote })
      .eq('id', eventId)
      .eq('period_id', periodId)

    setIsSavingGeneralNote(false)
    if (error) {
      setGeneralNoteError('Genel not kaydedilemedi. Dönem kilitli olabilir veya yetkiniz yok.')
      return
    }

    setEvent((previous) => (previous ? { ...previous, generalNote: finalNote } : previous))
    setIsEditingGeneralNote(false)
    setGeneralNoteSuccess('Genel not başarıyla güncellendi.')
    window.setTimeout(() => setGeneralNoteSuccess(null), 3000)
  }

  async function handleAssignSksMember() {
    if (!profileId || !eventId || !sksSelectedProfileId) {
      setAssignSksError('Lütfen bir üye seçin.')
      return
    }

    const sksMembersOnly = processMembers.filter(m => m.processType === 'sks')
    if (sksMembersOnly.some((member) => member.profileId === sksSelectedProfileId)) {
      setAssignSksError('Bu kişi SKS ekibinde zaten bir sorumluluğa atanmış.')
      return
    }

    setIsAssigningSks(true)
    setAssignSksError(null)

    if (sksSelectedResponsibility === 'owner') {
      const existingOwner = sksMembersOnly.find((member) => member.responsibilityType === 'owner')
      if (existingOwner) {
        const { error: updateError } = await supabase
          .from('event_process_members')
          .update({ profile_id: sksSelectedProfileId, assigned_by: profileId })
          .eq('id', existingOwner.id)
        if (updateError) {
          setIsAssigningSks(false)
          setAssignSksError(updateError.message.includes('kilitli')
            ? 'Dönem kilitli olduğu için bu işlemi gerçekleştiremezsiniz.'
            : 'Mevcut SKS sorumlusu kaldırılamadı.')
          return
        }
        setIsAssigningSks(false)
        setSksSelectedProfileId('')
        setProcessMembersRefreshKey((current) => current + 1)
        return
      }
    }

    const { error } = await supabase.from('event_process_members').insert({
      event_id: eventId,
      process_type: 'sks',
      profile_id: sksSelectedProfileId,
      responsibility_type: sksSelectedResponsibility,
      assigned_by: profileId,
    })

    setIsAssigningSks(false)
    if (error) {
      setAssignSksError(error.message.includes('kilitli')
        ? 'Dönem kilitli olduğu için bu işlemi gerçekleştiremezsiniz.'
        : error.code === '42501'
          ? 'SKS ekibini yönetme yetkiniz bulunmuyor.'
          : 'SKS üyesi atanırken bir hata oluştu.')
      return
    }

    setSksSelectedProfileId('')
    setProcessMembersRefreshKey((current) => current + 1)
  }

  async function handleRemoveSksMember(memberId: string) {
    if (!profileId) return
    setRemovingSksMemberId(memberId)
    setRemoveSksError(null)
    const { error } = await supabase.from('event_process_members').delete().eq('id', memberId)
    setRemovingSksMemberId(null)

    if (error) {
      setRemoveSksError(error.message.includes('kilitli')
        ? 'Dönem kilitli olduğu için bu işlemi gerçekleştiremezsiniz.'
        : error.code === '42501'
          ? 'Bu kişiyi kaldırma yetkiniz bulunmuyor.'
          : 'Atama kaldırılırken bir hata oluştu.')
      return
    }
    setProcessMembersRefreshKey((current) => current + 1)
  }

  async function handleUpdateSksStatus(newSlug: string) {
    if (!profileId || !eventId) return
    setIsUpdatingSksStatus(true)
    setUpdateSksStatusError(null)
    setUpdateSksStatusSuccess(null)

    const { error } = await supabase.from('events').update({ sks_status: newSlug }).eq('id', eventId)
    setIsUpdatingSksStatus(false)
    if (error) {
      setUpdateSksStatusError(error.message.includes('kilitli')
        ? 'Dönem kilitli olduğu için bu işlemi gerçekleştiremezsiniz.'
        : error.code === '42501' || error.message.includes('yetkiniz')
          ? 'SKS durumunu değiştirme yetkiniz bulunmuyor.'
          : 'SKS durumu güncellenirken bir hata oluştu.')
      return
    }

    setUpdateSksStatusSuccess('SKS durumu başarıyla güncellendi.')
    setEvent((previous) => (previous ? { ...previous, sksStatus: newSlug } : previous))
  }

  async function handleAssignBudgetMember() {
    if (!profileId || !eventId || !budgetSelectedProfileId) {
      setAssignBudgetError('Lütfen bir üye seçin.')
      return
    }

    const budgetMembersOnly = processMembers.filter(m => m.processType === 'budget')
    if (budgetMembersOnly.some((member) => member.profileId === budgetSelectedProfileId)) {
      setAssignBudgetError('Bu kişi bütçe ekibinde zaten bir sorumluluğa atanmış.')
      return
    }

    setIsAssigningBudget(true)
    setAssignBudgetError(null)

    if (budgetSelectedResponsibility === 'owner') {
      const existingOwner = budgetMembersOnly.find((member) => member.responsibilityType === 'owner')
      if (existingOwner) {
        const { error: updateError } = await supabase
          .from('event_process_members')
          .update({ profile_id: budgetSelectedProfileId, assigned_by: profileId })
          .eq('id', existingOwner.id)
        if (updateError) {
          setIsAssigningBudget(false)
          setAssignBudgetError(updateError.message.includes('kilitli')
            ? 'Dönem kilitli olduğu için bu işlemi gerçekleştiremezsiniz.'
            : 'Mevcut Bütçe sorumlusu kaldırılamadı.')
          return
        }
        setIsAssigningBudget(false)
        setBudgetSelectedProfileId('')
        setProcessMembersRefreshKey((current) => current + 1)
        return
      }
    }

    const { error } = await supabase.from('event_process_members').insert({
      event_id: eventId,
      process_type: 'budget',
      profile_id: budgetSelectedProfileId,
      responsibility_type: budgetSelectedResponsibility,
      assigned_by: profileId,
    })

    setIsAssigningBudget(false)
    if (error) {
      setAssignBudgetError(error.message.includes('kilitli')
        ? 'Dönem kilitli olduğu için bu işlemi gerçekleştiremezsiniz.'
        : error.code === '42501'
          ? 'Bütçe ekibini yönetme yetkiniz bulunmuyor.'
          : 'Bütçe üyesi atanırken bir hata oluştu.')
      return
    }

    setBudgetSelectedProfileId('')
    setProcessMembersRefreshKey((current) => current + 1)
  }

  async function handleRemoveBudgetMember(memberId: string) {
    if (!profileId) return
    setRemovingBudgetMemberId(memberId)
    setRemoveBudgetError(null)
    const { error } = await supabase.from('event_process_members').delete().eq('id', memberId)
    setRemovingBudgetMemberId(null)

    if (error) {
      setRemoveBudgetError(error.message.includes('kilitli')
        ? 'Dönem kilitli olduğu için bu işlemi gerçekleştiremezsiniz.'
        : error.code === '42501'
          ? 'Bu kişiyi kaldırma yetkiniz bulunmuyor.'
          : 'Atama kaldırılırken bir hata oluştu.')
      return
    }
    setProcessMembersRefreshKey((current) => current + 1)
  }

  async function handleSaveBudget() {
    if (!eventId || !profileId) return
    setBudgetSaveError(null)

    const parsedEstimated = editEstimatedBudget === '' ? null : parseFloat(editEstimatedBudget)
    const parsedApproved = editApprovedBudget === '' ? null : parseFloat(editApprovedBudget)
    const parsedActual = editActualExpense === '' ? null : parseFloat(editActualExpense)

    if (
      (parsedEstimated !== null && isNaN(parsedEstimated)) ||
      (parsedApproved !== null && isNaN(parsedApproved)) ||
      (parsedActual !== null && isNaN(parsedActual))
    ) {
      setBudgetSaveError('Lütfen geçerli bir sayı girin.')
      return
    }

    if (
      (parsedEstimated !== null && parsedEstimated < 0) ||
      (parsedApproved !== null && parsedApproved < 0) ||
      (parsedActual !== null && parsedActual < 0)
    ) {
      setBudgetSaveError('Parasal alanlar negatif olamaz.')
      return
    }

    setIsSavingBudget(true)
    const trimmedNote = editBudgetNote.trim()
    const payload = {
      budget_status: editBudgetStatus || null,
      estimated_budget: parsedEstimated,
      approved_budget: parsedApproved,
      actual_expense: parsedActual,
      budget_note: trimmedNote.length > 0 ? trimmedNote : null
    }

    const { error } = await supabase.from('events').update(payload).eq('id', eventId)

    setIsSavingBudget(false)

    if (error) {
      setBudgetSaveError(error.message.includes('kilitli')
        ? 'Dönem kilitli olduğu için bu işlemi gerçekleştiremezsiniz.'
        : error.message.includes('yetkiniz') || error.code === '42501'
          ? 'Bütçe alanlarını değiştirme yetkiniz bulunmuyor.'
          : 'Bütçe bilgileri güncellenirken bir hata oluştu.')
      return
    }

    setBudgetSaveSuccess('Bütçe bilgileri başarıyla güncellendi.')
    setEvent(prev => prev ? {
      ...prev,
      budgetStatus: payload.budget_status,
      estimatedBudget: payload.estimated_budget,
      approvedBudget: payload.approved_budget,
      actualExpense: payload.actual_expense,
      budgetNote: payload.budget_note
    } : prev)
    setIsEditingBudget(false)
    window.setTimeout(() => setBudgetSaveSuccess(null), 3000)
  }

  function startEditingBudget() {
    if (!event) return
    setEditBudgetStatus(event.budgetStatus ?? '')
    setEditEstimatedBudget(event.estimatedBudget !== null ? String(event.estimatedBudget) : '')
    setEditApprovedBudget(event.approvedBudget !== null ? String(event.approvedBudget) : '')
    setEditActualExpense(event.actualExpense !== null ? String(event.actualExpense) : '')
    setEditBudgetNote(event.budgetNote ?? '')
    setBudgetSaveError(null)
    setBudgetSaveSuccess(null)
    setIsEditingBudget(true)
  }

  function openCreateSponsorForm() {
    setSponsorFormMode('create')
    setEditingSponsorId(null)
    setSponsorName('')
    setSponsorAmount('')
    setSponsorNote('')
    setSponsorFormError(null)
    setSponsorSuccessMessage(null)
    setIsSponsorFormOpen(true)
  }

  function openEditSponsorForm(sponsor: EventBudgetSponsor) {
    setSponsorFormMode('edit')
    setEditingSponsorId(sponsor.id)
    setSponsorName(sponsor.sponsorName)
    setSponsorAmount(String(sponsor.amount))
    setSponsorNote(sponsor.note ?? '')
    setSponsorFormError(null)
    setSponsorSuccessMessage(null)
    setIsSponsorFormOpen(true)
  }

  function closeSponsorForm() {
    setIsSponsorFormOpen(false)
    setSponsorFormError(null)
  }

  async function handleSaveSponsor() {
    if (!eventId || !profileId) return
    setSponsorFormError(null)

    const tName = sponsorName.trim()
    const parsedAmount = sponsorAmount === '' ? null : parseFloat(sponsorAmount)
    const tNote = sponsorNote.trim()

    if (!tName) {
      setSponsorFormError('Sponsor adı boş bırakılamaz.')
      return
    }

    if (parsedAmount === null || isNaN(parsedAmount) || parsedAmount < 0) {
      setSponsorFormError('Lütfen geçerli ve pozitif bir tutar girin.')
      return
    }

    setIsSavingSponsor(true)
    const payload = {
      sponsor_name: tName,
      amount: parsedAmount,
      note: tNote.length > 0 ? tNote : null,
    }

    let error
    if (sponsorFormMode === 'create') {
      const res = await supabase.from('event_budget_sponsors').insert({
        event_id: eventId,
        created_by: profileId,
        ...payload,
      })
      error = res.error
    } else {
      const res = await supabase.from('event_budget_sponsors').update(payload).eq('id', editingSponsorId)
      error = res.error
    }

    setIsSavingSponsor(false)

    if (error) {
      if (error.message.includes('kilitli')) {
        setSponsorFormError('Dönem kilitli olduğu için bu işlemi gerçekleştiremezsiniz.')
      } else if (error.code === '42501') {
        setSponsorFormError('Sponsor ekleme veya düzenleme yetkiniz bulunmuyor.')
      } else {
        setSponsorFormError('Sponsor kaydedilirken bir hata oluştu.')
      }
      return
    }

    closeSponsorForm()
    setSponsorSuccessMessage(
      sponsorFormMode === 'create' ? 'Sponsor başarıyla eklendi.' : 'Sponsor başarıyla güncellendi.'
    )
    setSponsorsRefreshKey((prev) => prev + 1)
  }

  async function handleDeactivateSponsor(id: string) {
    if (!profileId) return
    if (!window.confirm('Bu sponsoru pasifleştirmek istediğinize emin misiniz?')) return

    setDeactivatingSponsorId(id)
    const { error } = await supabase
      .from('event_budget_sponsors')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: profileId,
        deletion_note: 'Sponsor pasifleştirildi',
      })
      .eq('id', id)

    setDeactivatingSponsorId(null)

    if (error) {
      if (error.message.includes('kilitli')) {
        alert('Dönem kilitli olduğu için sponsor pasifleştirilemedi.')
      } else {
        alert('Sponsor pasifleştirilemedi.')
      }
      return
    }

    setSponsorSuccessMessage('Sponsor pasifleştirildi.')
    setSponsorsRefreshKey((prev) => prev + 1)
  }

  async function handleReactivateSponsor(id: string) {
    if (!profileId) return

    setDeactivatingSponsorId(id)
    const { error } = await supabase
      .from('event_budget_sponsors')
      .update({ deleted_at: null, deleted_by: null, deletion_note: null })
      .eq('id', id)

    setDeactivatingSponsorId(null)

    if (error) {
      if (error.message.includes('kilitli')) {
        alert('Dönem kilitli olduğu için sponsor yeniden aktifleştirilemedi.')
      } else {
        alert('Sponsor yeniden aktifleştirilemedi.')
      }
      return
    }

    setSponsorSuccessMessage('Sponsor yeniden aktifleştirildi.')
    setSponsorsRefreshKey((prev) => prev + 1)
  }

  const isOwner = !!event && !!profileId && event.ownerId === profileId
  const isSuperAdmin = appRole === 'super_admin'
  const canEdit = isOwner || isSuperAdmin

  const sksMembers = processMembers.filter(m => m.processType === 'sks')
  const sksOwner = sksMembers.find((member) => member.responsibilityType === 'owner')
  const isSksOwner = sksOwner?.profileId === profileId
  const canChangeSksStatus = isSuperAdmin || isSksOwner
  const canManageSksTeam = isSuperAdmin || isOwner || isSksOwner

  const budgetMembers = processMembers.filter(m => m.processType === 'budget')
  const budgetOwner = budgetMembers.find((member) => member.responsibilityType === 'owner')
  const isBudgetOwner = budgetOwner?.profileId === profileId
  const canChangeBudgetFields = isSuperAdmin || isBudgetOwner
  const canManageBudgetTeam = isSuperAdmin || isOwner || isBudgetOwner

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
        .select('profile_id, coordinator_roles(slug)')
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

      const membershipRoleByProfileId = new Map<string, string | null>()
      for (const membership of membershipRows ?? []) {
        const relation = membership.coordinator_roles as { slug?: string } | { slug?: string }[] | null | undefined
        const role = Array.isArray(relation) ? relation[0] : relation
        membershipRoleByProfileId.set(membership.profile_id as string, role?.slug ?? null)
      }

      setPeriodMembers(
        (profileRows ?? []).map((row) => ({
          profileId: row.id as string,
          displayName: (row.display_name as string | null) ?? 'İsimsiz üye',
          coordinatorRoleSlug: membershipRoleByProfileId.get(row.id as string) ?? null,
        })),
      )
      setPeriodMembersLoadState('ready')
    }

    void loadPeriodMembers()
    return () => {
      isMounted = false
    }
  }, [canEdit, periodId])

  useEffect(() => {
    if (sksMembers.some((member) => member.responsibilityType === 'owner')) return
    const generalSecretary = periodMembers.find((member) => member.coordinatorRoleSlug === 'general-secretary')
    if (generalSecretary) {
      setSksSelectedProfileId(generalSecretary.profileId)
      setSksSelectedResponsibility('owner')
    }
  }, [periodMembers, sksMembers])

  useEffect(() => {
    if (budgetMembers.some((member) => member.responsibilityType === 'owner')) return
    const treasurer = periodMembers.find((member) => member.coordinatorRoleSlug === 'treasurer')
    if (treasurer) {
      setBudgetSelectedProfileId(treasurer.profileId)
      setBudgetSelectedResponsibility('owner')
    }
  }, [periodMembers, budgetMembers])

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

  const assignableBudgetMembers = periodMembers.filter((member) => !budgetMembers.some((assignedMember) => assignedMember.profileId === member.profileId))
  const budgetOwnerCandidates = assignableBudgetMembers.filter(m => m.coordinatorRoleSlug === 'treasurer')
  const displayBudgetMembers = budgetSelectedResponsibility === 'owner' ? budgetOwnerCandidates : assignableBudgetMembers

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
          <h2 className="text-sm font-semibold text-ink">Genel etkinlik notu</h2>
          <div className="mt-4">
            {canEdit && isEditingGeneralNote ? (
              <div className="flex flex-col gap-3">
                <textarea
                  value={generalNoteInputValue}
                  onChange={(event) => setGeneralNoteInputValue(event.target.value)}
                  disabled={isSavingGeneralNote}
                  rows={4}
                  className="w-full rounded-md border border-canvas-border bg-canvas px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink disabled:opacity-60"
                  placeholder="Bu etkinlikle ilgili genel notlarınızı buraya yazabilirsiniz..."
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSaveGeneralNote()}
                    disabled={isSavingGeneralNote}
                    className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-canvas-surface disabled:opacity-60"
                  >
                    {isSavingGeneralNote ? 'Kaydediliyor…' : 'Kaydet'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingGeneralNote(false)}
                    disabled={isSavingGeneralNote}
                    className="rounded-md border border-canvas-border px-4 py-2 text-sm font-medium text-ink-soft disabled:opacity-60"
                  >
                    İptal
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-start gap-3">
                {event.generalNote ? (
                  <p className="whitespace-pre-wrap text-sm text-ink">{event.generalNote}</p>
                ) : (
                  <p className="text-sm italic text-ink-soft">Not eklenmemiş</p>
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setIsEditingGeneralNote(true)}
                    className="rounded-md border border-canvas-border bg-canvas px-3 py-1.5 text-xs font-medium text-ink hover:bg-canvas-surface"
                  >
                    {event.generalNote ? 'Notu Düzenle' : 'Not Ekle'}
                  </button>
                )}
              </div>
            )}

            {generalNoteError && (
              <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {generalNoteError}
              </p>
            )}
            {generalNoteSuccess && !isEditingGeneralNote && (
              <p className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
                {generalNoteSuccess}
              </p>
            )}
          </div>
        </div>

        {/* Kararlar Bölümü */}
        <div className="mt-6 rounded-lg border border-canvas-border bg-canvas-surface p-6 shadow-card">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-4">
              <h2 className="text-sm font-semibold text-ink">Kararlar</h2>
              {canEdit && (
                <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-soft">
                  <input
                    type="checkbox"
                    checked={showInactiveDecisions}
                    onChange={(event) => setShowInactiveDecisions(event.target.checked)}
                    className="rounded border-canvas-border text-ink focus:ring-ink"
                  />
                  Pasif kararları göster
                </label>
              )}
            </div>
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
                <div
                  key={decision.id}
                  className={`rounded-md border px-4 py-3 ${
                    decision.deletedAt ? 'border-red-200 bg-red-50/40' : 'border-canvas-border bg-canvas'
                  }`}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-semibold text-ink">{decision.title}</h4>
                        {decision.deletedAt && (
                          <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                            Pasif karar
                          </span>
                        )}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{decision.decisionText}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
                        <span>{formatDate(decision.decidedAt)}</span>
                        <span>{decision.creatorName}</span>
                      </div>
                    </div>
                    {canEdit && !decision.deletedAt && (
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
                    {canEdit && decision.deletedAt && (
                      <button
                        type="button"
                        onClick={() => void handleReactivateDecision(decision.id)}
                        disabled={deactivatingDecisionId === decision.id}
                        className="shrink-0 rounded border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-700 disabled:opacity-50"
                      >
                        {deactivatingDecisionId === decision.id ? 'İşleniyor…' : 'Yeniden aktifleştir'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Raporlar Bölümü */}
        <div className="mt-6 rounded-lg border border-canvas-border bg-canvas-surface p-6 shadow-card">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-4">
              <h2 className="text-sm font-semibold text-ink">Raporlar</h2>
              {canEdit && (
                <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-soft">
                  <input
                    type="checkbox"
                    checked={showInactiveReports}
                    onChange={(event) => setShowInactiveReports(event.target.checked)}
                    className="rounded border-canvas-border text-ink focus:ring-ink"
                  />
                  Pasif raporları göster
                </label>
              )}
            </div>
            {canEdit && !isReportFormOpen && (
              <button
                type="button"
                onClick={openCreateReportForm}
                className="shrink-0 rounded-md border border-canvas-border bg-canvas px-3 py-1.5 text-sm font-medium text-ink hover:bg-canvas-surface"
              >
                Rapor ekle
              </button>
            )}
          </div>

          {reportSuccessMessage && !isReportFormOpen && (
            <p className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {reportSuccessMessage}
            </p>
          )}

          {isReportFormOpen && (
            <div className="mt-4 rounded-md border border-canvas-border bg-canvas px-4 py-4">
              <h3 className="text-sm font-semibold text-ink">
                {reportFormMode === 'create' ? 'Yeni rapor' : 'Raporu düzenle'}
              </h3>
              <div className="mt-3 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label htmlFor="report-title" className="text-sm font-medium text-ink-soft">
                    Rapor başlığı
                  </label>
                  <input
                    id="report-title"
                    type="text"
                    value={reportTitle}
                    onChange={(e) => setReportTitle(e.target.value)}
                    disabled={isSavingReport}
                    className="rounded-md border border-canvas-border bg-canvas-surface px-3 py-2 text-sm text-ink"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="report-text" className="text-sm font-medium text-ink-soft">
                    Rapor metni
                  </label>
                  <textarea
                    id="report-text"
                    value={reportText}
                    onChange={(e) => setReportText(e.target.value)}
                    disabled={isSavingReport}
                    rows={4}
                    className="rounded-md border border-canvas-border bg-canvas-surface px-3 py-2 text-sm text-ink"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="report-date" className="text-sm font-medium text-ink-soft">
                      Rapor tarihi
                    </label>
                    <input
                      id="report-date"
                      type="date"
                      value={reportDate}
                      onChange={(e) => setReportDate(e.target.value)}
                      disabled={isSavingReport}
                      className="rounded-md border border-canvas-border bg-canvas-surface px-3 py-2 text-sm text-ink"
                    />
                  </div>
                </div>
                {reportFormError && (
                  <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {reportFormError}
                  </p>
                )}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void handleSaveReport()}
                    disabled={isSavingReport}
                    className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-canvas-surface disabled:opacity-60"
                  >
                    {isSavingReport ? 'Kaydediliyor…' : 'Kaydet'}
                  </button>
                  <button
                    type="button"
                    onClick={closeReportForm}
                    disabled={isSavingReport}
                    className="rounded-md border border-canvas-border px-4 py-2 text-sm font-medium text-ink-soft disabled:opacity-60"
                  >
                    İptal
                  </button>
                </div>
              </div>
            </div>
          )}

          {reportsLoadState === 'loading' && (
            <p className="mt-3 text-sm text-ink-soft">Raporlar yükleniyor…</p>
          )}
          {reportsLoadState === 'error' && (
            <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Raporlar yüklenirken bir hata oluştu.
            </p>
          )}
          {reportsLoadState === 'ready' && reports.length === 0 && (
            <p className="mt-3 text-sm italic text-ink-soft">Bu etkinlik için henüz rapor eklenmemiş.</p>
          )}
          {reportsLoadState === 'ready' && reports.length > 0 && (
            <div className="mt-4 flex flex-col gap-4">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className={`rounded-md border px-4 py-3 ${
                    report.deletedAt ? 'border-red-200 bg-red-50/40' : 'border-canvas-border bg-canvas'
                  }`}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-semibold text-ink">{report.title}</h4>
                        {report.deletedAt && (
                          <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                            Pasif rapor
                          </span>
                        )}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink-soft">{report.reportText}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
                        <span>{formatDate(report.reportDate)}</span>
                        <span>{report.creatorName}</span>
                      </div>
                    </div>
                    {canEdit && !report.deletedAt && (
                      <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-2">
                        <button
                          type="button"
                          onClick={() => openEditReportForm(report)}
                          className="text-xs font-medium text-ink-soft underline decoration-dotted"
                        >
                          Düzenle
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeactivateReport(report.id)}
                          disabled={deactivatingReportId === report.id}
                          className="text-xs font-medium text-red-600 underline decoration-dotted disabled:opacity-50"
                        >
                          {deactivatingReportId === report.id ? 'İşleniyor…' : 'Pasifleştir'}
                        </button>
                      </div>
                    )}
                    {canEdit && report.deletedAt && (
                      <button
                        type="button"
                        onClick={() => void handleReactivateReport(report.id)}
                        disabled={deactivatingReportId === report.id}
                        className="shrink-0 rounded border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-700 disabled:opacity-50"
                      >
                        {deactivatingReportId === report.id ? 'İşleniyor…' : 'Yeniden aktifleştir'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bağlantılar Bölümü */}
        <div className="mt-6 rounded-lg border border-canvas-border bg-canvas-surface p-6 shadow-card">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-4">
              <h2 className="text-sm font-semibold text-ink">Etkinlik Bağlantıları</h2>
              {canEdit && (
                <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-soft">
                  <input
                    type="checkbox"
                    checked={showInactiveLinks}
                    onChange={(event) => setShowInactiveLinks(event.target.checked)}
                    className="rounded border-canvas-border text-ink focus:ring-ink"
                  />
                  Pasif bağlantıları göster
                </label>
              )}
            </div>
            {canEdit && !isLinkFormOpen && (
              <button
                type="button"
                onClick={openCreateLinkForm}
                className="shrink-0 rounded-md border border-canvas-border bg-canvas px-3 py-1.5 text-sm font-medium text-ink hover:bg-canvas-surface"
              >
                Bağlantı ekle
              </button>
            )}
          </div>

          {linkSuccessMessage && !isLinkFormOpen && (
            <p className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {linkSuccessMessage}
            </p>
          )}

          {isLinkFormOpen && (
            <div className="mt-4 rounded-md border border-canvas-border bg-canvas px-4 py-4">
              <h3 className="text-sm font-semibold text-ink">
                {linkFormMode === 'create' ? 'Yeni bağlantı' : 'Bağlantıyı düzenle'}
              </h3>
              <div className="mt-3 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label htmlFor="link-title" className="text-sm font-medium text-ink-soft">
                    Bağlantı başlığı
                  </label>
                  <input
                    id="link-title"
                    type="text"
                    value={linkTitle}
                    onChange={(e) => setLinkTitle(e.target.value)}
                    disabled={isSavingLink}
                    className="rounded-md border border-canvas-border bg-canvas-surface px-3 py-2 text-sm text-ink"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="link-url" className="text-sm font-medium text-ink-soft">
                    URL (http:// veya https://)
                  </label>
                  <input
                    id="link-url"
                    type="text"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    disabled={isSavingLink}
                    className="rounded-md border border-canvas-border bg-canvas-surface px-3 py-2 text-sm text-ink"
                    placeholder="https://ornek.com"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="link-description" className="text-sm font-medium text-ink-soft">
                    Açıklama (İsteğe bağlı)
                  </label>
                  <textarea
                    id="link-description"
                    value={linkDescription}
                    onChange={(e) => setLinkDescription(e.target.value)}
                    disabled={isSavingLink}
                    rows={2}
                    className="rounded-md border border-canvas-border bg-canvas-surface px-3 py-2 text-sm text-ink"
                  />
                </div>
                {linkFormError && (
                  <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {linkFormError}
                  </p>
                )}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void handleSaveLink()}
                    disabled={isSavingLink}
                    className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-canvas-surface disabled:opacity-60"
                  >
                    {isSavingLink ? 'Kaydediliyor…' : 'Kaydet'}
                  </button>
                  <button
                    type="button"
                    onClick={closeLinkForm}
                    disabled={isSavingLink}
                    className="rounded-md border border-canvas-border px-4 py-2 text-sm font-medium text-ink-soft disabled:opacity-60"
                  >
                    İptal
                  </button>
                </div>
              </div>
            </div>
          )}

          {linksLoadState === 'loading' && (
            <p className="mt-3 text-sm text-ink-soft">Bağlantılar yükleniyor…</p>
          )}
          {linksLoadState === 'error' && (
            <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Bağlantılar yüklenirken bir hata oluştu.
            </p>
          )}
          {linksLoadState === 'ready' && links.length === 0 && (
            <p className="mt-3 text-sm italic text-ink-soft">Bu etkinlik için henüz bağlantı eklenmemiş.</p>
          )}
          {linksLoadState === 'ready' && links.length > 0 && (
            <div className="mt-4 flex flex-col gap-4">
              {links.map((link) => (
                <div
                  key={link.id}
                  className={`rounded-md border px-4 py-3 ${
                    link.deletedAt ? 'border-red-200 bg-red-50/40' : 'border-canvas-border bg-canvas'
                  }`}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 overflow-hidden">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-semibold text-ink">{link.title}</h4>
                        {link.deletedAt && (
                          <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                            Pasif bağlantı
                          </span>
                        )}
                      </div>
                      {link.description && (
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink-soft">{link.description}</p>
                      )}
                      <div className="mt-2">
                         <a href={link.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand hover:underline break-all">
                            {link.url}
                         </a>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
                        <span>{formatDate(link.createdAt)}</span>
                        <span>{link.creatorName}</span>
                      </div>
                    </div>
                    {canEdit && !link.deletedAt && (
                      <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-2">
                        <button
                          type="button"
                          onClick={() => openEditLinkForm(link)}
                          className="text-xs font-medium text-ink-soft underline decoration-dotted"
                        >
                          Düzenle
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeactivateLink(link.id)}
                          disabled={deactivatingLinkId === link.id}
                          className="text-xs font-medium text-red-600 underline decoration-dotted disabled:opacity-50"
                        >
                          {deactivatingLinkId === link.id ? 'İşleniyor…' : 'Pasifleştir'}
                        </button>
                      </div>
                    )}
                    {canEdit && link.deletedAt && (
                      <button
                        type="button"
                        onClick={() => void handleReactivateLink(link.id)}
                        disabled={deactivatingLinkId === link.id}
                        className="shrink-0 rounded border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-700 disabled:opacity-50"
                      >
                        {deactivatingLinkId === link.id ? 'İşleniyor…' : 'Yeniden aktifleştir'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dosyalar Bölümü */}
        <div className="mt-6 rounded-lg border border-canvas-border bg-canvas-surface p-6 shadow-card">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-4">
              <h2 className="text-sm font-semibold text-ink">Dosyalar</h2>
              {canEdit && (
                <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-soft">
                  <input
                    type="checkbox"
                    checked={showInactiveFiles}
                    onChange={(event) => setShowInactiveFiles(event.target.checked)}
                    className="rounded border-canvas-border text-ink focus:ring-ink"
                  />
                  Pasif dosyaları göster
                </label>
              )}
            </div>
            {canEdit && !isFileFormOpen && (
              <button
                type="button"
                onClick={openFileUploadForm}
                className="shrink-0 rounded-md border border-canvas-border bg-canvas px-3 py-1.5 text-sm font-medium text-ink hover:bg-canvas-surface"
              >
                Dosya ekle
              </button>
            )}
          </div>

          {fileSuccessMessage && !isFileFormOpen && (
            <p className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {fileSuccessMessage}
            </p>
          )}

          {isFileFormOpen && (
            <div className="mt-4 rounded-md border border-canvas-border bg-canvas px-4 py-4">
              <h3 className="text-sm font-semibold text-ink">Yeni dosya</h3>
              <div className="mt-3 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label htmlFor="file-upload-input" className="text-sm font-medium text-ink-soft">
                    Dosya seç (en fazla 5 MB)
                  </label>
                  <input
                    id="file-upload-input"
                    type="file"
                    onChange={(e) => {
                      const chosen = e.target.files && e.target.files[0] ? e.target.files[0] : null
                      setSelectedUploadFile(chosen)
                      setFileFormError(null)
                    }}
                    disabled={isUploadingFile}
                    className="rounded-md border border-canvas-border bg-canvas-surface px-3 py-2 text-sm text-ink"
                  />
                  {selectedUploadFile && (
                    <p className="mt-1 break-words text-xs text-ink-soft">
                      Seçilen dosya: {selectedUploadFile.name} ({formatFileSize(selectedUploadFile.size)})
                    </p>
                  )}
                </div>
                {fileFormError && (
                  <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {fileFormError}
                  </p>
                )}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void handleUploadFile()}
                    disabled={isUploadingFile || !selectedUploadFile}
                    className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-canvas-surface disabled:opacity-60"
                  >
                    {isUploadingFile ? 'Yükleniyor…' : 'Yükle'}
                  </button>
                  <button
                    type="button"
                    onClick={closeFileUploadForm}
                    disabled={isUploadingFile}
                    className="rounded-md border border-canvas-border px-4 py-2 text-sm font-medium text-ink-soft disabled:opacity-60"
                  >
                    İptal
                  </button>
                </div>
              </div>
            </div>
          )}

          {filesLoadState === 'loading' && (
            <p className="mt-3 text-sm text-ink-soft">Dosyalar yükleniyor…</p>
          )}
          {filesLoadState === 'error' && (
            <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Dosyalar yüklenirken bir hata oluştu.
            </p>
          )}
          {filesLoadState === 'ready' && files.length === 0 && (
            <p className="mt-3 text-sm italic text-ink-soft">Bu etkinlik için henüz dosya eklenmemiş.</p>
          )}
          {filesLoadState === 'ready' && files.length > 0 && (
            <div className="mt-4 flex flex-col gap-4">
              {files.map((file) => (
                <div
                  key={file.id}
                  className={`rounded-md border px-4 py-3 ${
                    file.deletedAt ? 'border-red-200 bg-red-50/40' : 'border-canvas-border bg-canvas'
                  }`}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 overflow-hidden">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="break-words text-sm font-semibold text-ink">{file.originalFileName}</h4>
                        {file.deletedAt && (
                          <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                            Pasif dosya
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
                        <span>{file.mimeType}</span>
                        <span>{formatFileSize(file.fileSizeBytes)}</span>
                        <span>{file.uploaderName}</span>
                        <span>{formatDate(file.createdAt)}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => void handleDownloadFile(file)}
                          disabled={downloadingFileId === file.id}
                          className="rounded-md border border-canvas-border bg-canvas px-3 py-1.5 text-xs font-medium text-ink hover:bg-canvas-surface disabled:opacity-60"
                        >
                          {downloadingFileId === file.id ? 'İndiriliyor…' : 'Aç / İndir'}
                        </button>
                      </div>
                      {downloadErrorMap[file.id] && (
                        <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                          {downloadErrorMap[file.id]}
                        </p>
                      )}
                    </div>
                    {canEdit && !file.deletedAt && (
                      <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-2">
                        <button
                          type="button"
                          onClick={() => void handleDeactivateFile(file.id)}
                          disabled={deactivatingFileId === file.id}
                          className="text-xs font-medium text-red-600 underline decoration-dotted disabled:opacity-50"
                        >
                          {deactivatingFileId === file.id ? 'İşleniyor…' : 'Pasifleştir'}
                        </button>
                      </div>
                    )}
                    {canEdit && file.deletedAt && (
                      <button
                        type="button"
                        onClick={() => void handleReactivateFile(file.id)}
                        disabled={deactivatingFileId === file.id}
                        className="shrink-0 rounded border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-700 disabled:opacity-50"
                      >
                        {deactivatingFileId === file.id ? 'İşleniyor…' : 'Yeniden aktifleştir'}
                      </button>
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

        {/* SKS Süreci */}
        <div className="mt-6 rounded-lg border border-canvas-border bg-canvas-surface p-6 shadow-card">
          <h2 className="text-sm font-semibold text-ink">SKS Süreci</h2>
          <div className="mt-4 flex flex-col gap-4">
            <div>
              <span className="text-sm font-medium text-ink-soft">SKS durumu</span>
              <div className="mt-2 flex items-center gap-3">
                {canChangeSksStatus ? (
                  <select
                    value={event.sksStatus ?? ''}
                    onChange={(e) => void handleUpdateSksStatus(e.target.value)}
                    disabled={isUpdatingSksStatus || availableSksStatuses.length === 0}
                    className="rounded-md border border-canvas-border bg-canvas px-3 py-2 text-sm text-ink disabled:opacity-60"
                  >
                    <option value="" disabled>Durum seçin</option>
                    {availableSksStatuses.map((status) => <option key={status.slug} value={status.slug}>{status.label}</option>)}
                  </select>
                ) : (
                  <span className="rounded-full border border-canvas-border bg-canvas px-3 py-1 text-sm font-medium text-ink">
                    {event.sksStatus ? (availableSksStatuses.find((status) => status.slug === event.sksStatus)?.label ?? event.sksStatus) : 'Belirtilmemiş'}
                  </span>
                )}
                {isUpdatingSksStatus && <span className="text-xs text-ink-soft">Kaydediliyor…</span>}
              </div>
              {updateSksStatusError && <p className="mt-1 text-xs text-red-600">{updateSksStatusError}</p>}
              {updateSksStatusSuccess && <p className="mt-1 text-xs text-green-600">{updateSksStatusSuccess}</p>}
            </div>

            <div className="border-t border-canvas-border pt-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-medium text-ink">SKS ekibi</h3>
                {canManageSksTeam && (
                  <button type="button" onClick={() => setIsSksPanelOpen((open) => !open)} className="text-xs font-medium text-ink hover:underline">
                    {isSksPanelOpen ? 'Ekip yönetimini kapat' : 'Ekibi yönet'}
                  </button>
                )}
              </div>
              {processMembersLoadState === 'loading' && <p className="mt-3 text-sm text-ink-soft">SKS ekibi yükleniyor…</p>}
              {processMembersLoadState === 'error' && <p className="mt-3 text-sm text-red-600">SKS ekibi yüklenirken bir hata oluştu.</p>}
              {processMembersLoadState === 'ready' && (
                <div className="mt-3 flex flex-col gap-3">
                  {(['owner', 'supporting', 'informed'] as const).map((responsibilityType) => {
                    const members = sksMembers.filter((member) => member.responsibilityType === responsibilityType)
                    const label = responsibilityType === 'owner' ? 'Ana sorumlu' : responsibilityType === 'supporting' ? 'Destekleyen' : 'Bilgilendirilen'
                    return (
                      <div key={responsibilityType}>
                        <span className="block text-xs font-medium text-ink-soft">{label}</span>
                        {members.length > 0 ? <div className="mt-1 flex flex-wrap gap-2 text-sm text-ink">{members.map((member) => <span key={member.id}>{member.displayName}</span>)}</div> : <span className="mt-1 block text-sm italic text-ink-soft">Atanmamış</span>}
                      </div>
                    )
                  })}
                </div>
              )}

              {isSksPanelOpen && canManageSksTeam && (
                <div className="mt-4 rounded-md border border-canvas-border bg-canvas px-4 py-4">
                  <h4 className="text-sm font-semibold text-ink">Ekip yönetimi</h4>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                    <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-ink-soft">
                      Üye
                      <select value={sksSelectedProfileId} onChange={(e) => setSksSelectedProfileId(e.target.value)} disabled={isAssigningSks || periodMembersLoadState === 'loading'} className="rounded-md border border-canvas-border bg-canvas-surface px-3 py-2 text-sm text-ink">
                        <option value="">Üye seçin</option>
                        {periodMembers.filter((member) => !sksMembers.some((assignedMember) => assignedMember.profileId === member.profileId)).map((member) => <option key={member.profileId} value={member.profileId}>{member.displayName}</option>)}
                      </select>
                    </label>
                    <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-ink-soft">
                      Sorumluluk türü
                      <select value={sksSelectedResponsibility} onChange={(e) => setSksSelectedResponsibility(e.target.value)} disabled={isAssigningSks} className="rounded-md border border-canvas-border bg-canvas-surface px-3 py-2 text-sm text-ink">
                        <option value="owner">Ana sorumlu</option><option value="supporting">Destekleyen</option><option value="informed">Bilgilendirilen</option>
                      </select>
                    </label>
                    <button type="button" onClick={() => void handleAssignSksMember()} disabled={isAssigningSks} className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-canvas-surface disabled:opacity-60">{isAssigningSks ? 'Ekleniyor…' : 'Ekle'}</button>
                  </div>
                  {assignSksError && <p className="mt-2 text-xs text-red-600">{assignSksError}</p>}
                  {removeSksError && <p className="mt-2 text-xs text-red-600">{removeSksError}</p>}
                  <div className="mt-4 flex flex-col gap-2">
                    {sksMembers.length === 0 ? <p className="text-xs text-ink-soft">Ekip üyesi yok.</p> : sksMembers.map((member) => (
                      <div key={member.id} className="flex items-center justify-between gap-2 rounded-md border border-canvas-border bg-canvas-surface px-3 py-2">
                        <span className="text-sm text-ink">{member.displayName}</span>
                        <button type="button" onClick={() => void handleRemoveSksMember(member.id)} disabled={removingSksMemberId === member.id} className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50">{removingSksMemberId === member.id ? 'Kaldırılıyor…' : 'Kaldır'}</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bütçe Süreci */}
        <div className="mt-6 rounded-lg border border-canvas-border bg-canvas-surface p-6 shadow-card">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-sm font-semibold text-ink">Bütçe Süreci</h2>
            {canChangeBudgetFields && !isEditingBudget && (
              <button
                type="button"
                onClick={startEditingBudget}
                className="shrink-0 rounded-md border border-canvas-border bg-canvas px-3 py-1.5 text-xs font-medium text-ink hover:bg-canvas-surface"
              >
                Düzenle
              </button>
            )}
          </div>

          {budgetSaveSuccess && !isEditingBudget && (
            <p className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {budgetSaveSuccess}
            </p>
          )}

          {isEditingBudget ? (
             <div className="mt-4 border-t border-canvas-border pt-4 flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                   <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-ink-soft">Bütçe Durumu</label>
                      <select
                         value={editBudgetStatus}
                         onChange={(e) => setEditBudgetStatus(e.target.value)}
                         disabled={isSavingBudget || availableBudgetStatuses.length === 0}
                         className="rounded-md border border-canvas-border bg-canvas px-3 py-2 text-sm text-ink disabled:opacity-60"
                      >
                         <option value="">Durum seçin</option>
                         {availableBudgetStatuses.map((status) => <option key={status.slug} value={status.slug}>{status.label}</option>)}
                      </select>
                   </div>
                   <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-ink-soft">Tahmini Bütçe (₺)</label>
                      <input
                         type="number"
                         step="0.01"
                         min="0"
                         value={editEstimatedBudget}
                         onChange={(e) => setEditEstimatedBudget(e.target.value)}
                         disabled={isSavingBudget}
                         className="rounded-md border border-canvas-border bg-canvas px-3 py-2 text-sm text-ink disabled:opacity-60"
                      />
                   </div>
                   <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-ink-soft">Onaylanan Bütçe (₺)</label>
                      <input
                         type="number"
                         step="0.01"
                         min="0"
                         value={editApprovedBudget}
                         onChange={(e) => setEditApprovedBudget(e.target.value)}
                         disabled={isSavingBudget}
                         className="rounded-md border border-canvas-border bg-canvas px-3 py-2 text-sm text-ink disabled:opacity-60"
                      />
                   </div>
                   <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-ink-soft">Gerçekleşen Harcama (₺)</label>
                      <input
                         type="number"
                         step="0.01"
                         min="0"
                         value={editActualExpense}
                         onChange={(e) => setEditActualExpense(e.target.value)}
                         disabled={isSavingBudget}
                         className="rounded-md border border-canvas-border bg-canvas px-3 py-2 text-sm text-ink disabled:opacity-60"
                      />
                   </div>
                </div>
                <div className="flex flex-col gap-1">
                   <label className="text-xs font-medium text-ink-soft">Bütçe Notu</label>
                   <textarea
                      value={editBudgetNote}
                      onChange={(e) => setEditBudgetNote(e.target.value)}
                      disabled={isSavingBudget}
                      rows={3}
                      className="rounded-md border border-canvas-border bg-canvas px-3 py-2 text-sm text-ink disabled:opacity-60"
                   />
                </div>

                {budgetSaveError && <p className="text-xs text-red-600">{budgetSaveError}</p>}

                <div className="flex items-center gap-3 mt-1">
                  <button
                    type="button"
                    onClick={() => void handleSaveBudget()}
                    disabled={isSavingBudget}
                    className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-canvas-surface disabled:opacity-60"
                  >
                    {isSavingBudget ? 'Kaydediliyor…' : 'Kaydet'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsEditingBudget(false); setBudgetSaveError(null); }}
                    disabled={isSavingBudget}
                    className="rounded-md border border-canvas-border px-4 py-2 text-sm font-medium text-ink-soft disabled:opacity-60"
                  >
                    İptal
                  </button>
                </div>
             </div>
          ) : (
             <div className="mt-3 divide-y divide-canvas-border">
                <DetailRow
                   label="Durum"
                   value={event.budgetStatus ? (availableBudgetStatuses.find(s => s.slug === event.budgetStatus)?.label ?? event.budgetStatus) : NOT_SPECIFIED}
                />
                <DetailRow label="Tahmini Bütçe" value={formatCurrency(event.estimatedBudget)} />
                <DetailRow label="Onaylanan Bütçe" value={formatCurrency(event.approvedBudget)} />
                <DetailRow label="Gerçekleşen Harcama" value={formatCurrency(event.actualExpense)} />
                <DetailRow label="Bütçe Notu" value={event.budgetNote || NOT_SPECIFIED} isMultiline />
             </div>
          )}

          <div className="border-t border-canvas-border pt-4 mt-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium text-ink">Bütçe ekibi</h3>
              {canManageBudgetTeam && (
                <button type="button" onClick={() => setIsBudgetPanelOpen((open) => !open)} className="text-xs font-medium text-ink hover:underline">
                  {isBudgetPanelOpen ? 'Ekip yönetimini kapat' : 'Ekibi yönet'}
                </button>
              )}
            </div>
            {processMembersLoadState === 'loading' && <p className="mt-3 text-sm text-ink-soft">Bütçe ekibi yükleniyor…</p>}
            {processMembersLoadState === 'error' && <p className="mt-3 text-sm text-red-600">Bütçe ekibi yüklenirken bir hata oluştu.</p>}
            {processMembersLoadState === 'ready' && (
              <div className="mt-3 flex flex-col gap-3">
                {(['owner', 'supporting', 'informed'] as const).map((responsibilityType) => {
                  const members = budgetMembers.filter((member) => member.responsibilityType === responsibilityType)
                  const label = responsibilityType === 'owner' ? 'Ana sorumlu' : responsibilityType === 'supporting' ? 'Destekleyen' : 'Bilgilendirilen'
                  return (
                    <div key={responsibilityType}>
                      <span className="block text-xs font-medium text-ink-soft">{label}</span>
                      {members.length > 0 ? <div className="mt-1 flex flex-wrap gap-2 text-sm text-ink">{members.map((member) => <span key={member.id}>{member.displayName}</span>)}</div> : <span className="mt-1 block text-sm italic text-ink-soft">Atanmamış</span>}
                    </div>
                  )
                })}
              </div>
            )}

            {isBudgetPanelOpen && canManageBudgetTeam && (
              <div className="mt-4 rounded-md border border-canvas-border bg-canvas px-4 py-4">
                <h4 className="text-sm font-semibold text-ink">Ekip yönetimi</h4>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                  <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-ink-soft">
                    Üye
                    <select value={budgetSelectedProfileId} onChange={(e) => setBudgetSelectedProfileId(e.target.value)} disabled={isAssigningBudget || periodMembersLoadState === 'loading'} className="rounded-md border border-canvas-border bg-canvas-surface px-3 py-2 text-sm text-ink">
                      <option value="">Üye seçin</option>
                      {displayBudgetMembers.map((member) => <option key={member.profileId} value={member.profileId}>{member.displayName}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-ink-soft">
                    Sorumluluk türü
                    <select value={budgetSelectedResponsibility} onChange={(e) => setBudgetSelectedResponsibility(e.target.value)} disabled={isAssigningBudget} className="rounded-md border border-canvas-border bg-canvas-surface px-3 py-2 text-sm text-ink">
                      <option value="owner">Ana sorumlu</option><option value="supporting">Destekleyen</option><option value="informed">Bilgilendirilen</option>
                    </select>
                  </label>
                  <button type="button" onClick={() => void handleAssignBudgetMember()} disabled={isAssigningBudget || (budgetSelectedResponsibility === 'owner' && budgetOwnerCandidates.length === 0)} className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-canvas-surface disabled:opacity-60">{isAssigningBudget ? 'Ekleniyor…' : 'Ekle'}</button>
                </div>
                {budgetSelectedResponsibility === 'owner' && budgetOwnerCandidates.length === 0 && (
                  <p className="mt-1 text-xs text-amber-600">Aktif dönemde atanabilecek Sayman bulunamadı.</p>
                )}
                {assignBudgetError && <p className="mt-2 text-xs text-red-600">{assignBudgetError}</p>}
                {removeBudgetError && <p className="mt-2 text-xs text-red-600">{removeBudgetError}</p>}
                <div className="mt-4 flex flex-col gap-2">
                  {budgetMembers.length === 0 ? <p className="text-xs text-ink-soft">Ekip üyesi yok.</p> : budgetMembers.map((member) => (
                    <div key={member.id} className="flex items-center justify-between gap-2 rounded-md border border-canvas-border bg-canvas-surface px-3 py-2">
                      <span className="text-sm text-ink">{member.displayName}</span>
                      <button type="button" onClick={() => void handleRemoveBudgetMember(member.id)} disabled={removingBudgetMemberId === member.id} className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50">{removingBudgetMemberId === member.id ? 'Kaldırılıyor…' : 'Kaldır'}</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sponsorlar Bölümü */}
          <div className="mt-6 border-t border-canvas-border pt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-4">
              <h2 className="text-sm font-semibold text-ink">Sponsorlar</h2>
              {canChangeBudgetFields && (
                <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-soft">
                  <input
                    type="checkbox"
                    checked={showInactiveSponsors}
                    onChange={(event) => setShowInactiveSponsors(event.target.checked)}
                    className="rounded border-canvas-border text-ink focus:ring-ink"
                  />
                  Pasif sponsorları göster
                </label>
              )}
            </div>
            {canChangeBudgetFields && !isSponsorFormOpen && (
              <button
                type="button"
                onClick={openCreateSponsorForm}
                className="shrink-0 rounded-md border border-canvas-border bg-canvas px-3 py-1.5 text-sm font-medium text-ink hover:bg-canvas-surface"
              >
                Sponsor ekle
              </button>
            )}
          </div>

          {sponsorSuccessMessage && !isSponsorFormOpen && (
            <p className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {sponsorSuccessMessage}
            </p>
          )}

          {isSponsorFormOpen && (
            <div className="mt-4 rounded-md border border-canvas-border bg-canvas px-4 py-4">
              <h3 className="text-sm font-semibold text-ink">
                {sponsorFormMode === 'create' ? 'Yeni Sponsor' : 'Sponsoru Düzenle'}
              </h3>
              <div className="mt-3 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label htmlFor="sponsor-name" className="text-sm font-medium text-ink-soft">
                    Sponsor Adı
                  </label>
                  <input
                    id="sponsor-name"
                    type="text"
                    value={sponsorName}
                    onChange={(e) => setSponsorName(e.target.value)}
                    disabled={isSavingSponsor}
                    className="rounded-md border border-canvas-border bg-canvas-surface px-3 py-2 text-sm text-ink"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="sponsor-amount" className="text-sm font-medium text-ink-soft">
                    Tutar (₺)
                  </label>
                  <input
                    id="sponsor-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={sponsorAmount}
                    onChange={(e) => setSponsorAmount(e.target.value)}
                    disabled={isSavingSponsor}
                    className="rounded-md border border-canvas-border bg-canvas-surface px-3 py-2 text-sm text-ink"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="sponsor-note" className="text-sm font-medium text-ink-soft">
                    Not (İsteğe bağlı)
                  </label>
                  <textarea
                    id="sponsor-note"
                    value={sponsorNote}
                    onChange={(e) => setSponsorNote(e.target.value)}
                    disabled={isSavingSponsor}
                    rows={2}
                    className="rounded-md border border-canvas-border bg-canvas-surface px-3 py-2 text-sm text-ink"
                  />
                </div>
                {sponsorFormError && (
                  <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {sponsorFormError}
                  </p>
                )}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void handleSaveSponsor()}
                    disabled={isSavingSponsor}
                    className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-canvas-surface disabled:opacity-60"
                  >
                    {isSavingSponsor ? 'Kaydediliyor…' : 'Kaydet'}
                  </button>
                  <button
                    type="button"
                    onClick={closeSponsorForm}
                    disabled={isSavingSponsor}
                    className="rounded-md border border-canvas-border px-4 py-2 text-sm font-medium text-ink-soft disabled:opacity-60"
                  >
                    İptal
                  </button>
                </div>
              </div>
            </div>
          )}

          {sponsorsLoadState === 'loading' && (
            <p className="mt-3 text-sm text-ink-soft">Sponsorlar yükleniyor…</p>
          )}
          {sponsorsLoadState === 'error' && (
            <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Sponsorlar yüklenirken bir hata oluştu.
            </p>
          )}
          {sponsorsLoadState === 'ready' && sponsors.length === 0 && (
            <p className="mt-3 text-sm italic text-ink-soft">Bu etkinlik için henüz sponsor eklenmemiş.</p>
          )}
          {sponsorsLoadState === 'ready' && sponsors.length > 0 && (
            <div className="mt-4 flex flex-col gap-4">
              {sponsors.map((sponsor) => (
                <div
                  key={sponsor.id}
                  className={`rounded-md border px-4 py-3 ${
                    sponsor.deletedAt ? 'border-red-200 bg-red-50/40' : 'border-canvas-border bg-canvas'
                  }`}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-semibold text-ink">{sponsor.sponsorName}</h4>
                        {sponsor.deletedAt && (
                          <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                            Pasif
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-medium text-brand">{formatCurrency(sponsor.amount)}</p>
                      {sponsor.note && (
                        <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{sponsor.note}</p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
                        <span>{formatDate(sponsor.createdAt)}</span>
                        <span>{sponsor.creatorName}</span>
                      </div>
                    </div>
                    {canChangeBudgetFields && !sponsor.deletedAt && (
                      <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-2">
                        <button
                          type="button"
                          onClick={() => openEditSponsorForm(sponsor)}
                          className="text-xs font-medium text-ink-soft underline decoration-dotted"
                        >
                          Düzenle
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeactivateSponsor(sponsor.id)}
                          disabled={deactivatingSponsorId === sponsor.id}
                          className="text-xs font-medium text-red-600 underline decoration-dotted disabled:opacity-50"
                        >
                          {deactivatingSponsorId === sponsor.id ? 'İşleniyor…' : 'Pasifleştir'}
                        </button>
                      </div>
                    )}
                    {canChangeBudgetFields && sponsor.deletedAt && (
                      <button
                        type="button"
                        onClick={() => void handleReactivateSponsor(sponsor.id)}
                        disabled={deactivatingSponsorId === sponsor.id}
                        className="shrink-0 rounded border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-700 disabled:opacity-50"
                      >
                        {deactivatingSponsorId === sponsor.id ? 'İşleniyor…' : 'Yeniden aktifleştir'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
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
