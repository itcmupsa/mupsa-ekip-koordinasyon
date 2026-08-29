import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import EventCoordinatorsPanel from '../components/events/EventCoordinatorsPanel'
import { useSession } from '../hooks/useSession'
import { useMembershipStatus } from '../hooks/useMembershipStatus'
import { supabase } from '../lib/supabaseClient'

interface EventBasicInfo {
  title: string
  description: string | null
  eventStatus: string | null
  sksStatus: string | null
  budgetStatus: string | null
  designAnnouncementStatus: string
  announcementStatus: string
  reportStatus: string
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
  activationStatusSlug: string
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
  coordinatorRoleName: string | null
}

type EventDetailTab = 'overview' | 'content' | 'operations'

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

interface EventDesignAnnouncementStatusOption {
  slug: string
  label: string
}

interface EventAnnouncementStatusOption {
  slug: string
  label: string
}

interface EventReportStatusOption {
  slug: string
  label: string
}

interface EventStatusOption {
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

type EventVisualIcon = 'status' | 'person' | 'building' | 'calendar' | 'check' | 'overview' | 'content' | 'operations' | 'note' | 'task' | 'sks' | 'budget' | 'decision' | 'report' | 'link' | 'file' | 'pin' | 'edit'

function EventIcon({ name, className = 'h-5 w-5' }: { name: EventVisualIcon; className?: string }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const paths: Record<EventVisualIcon, ReactNode> = {
    status: <><path d="M9 18h6"/><path d="M10 22h4"/><path d="M8.5 14.5A6 6 0 1 1 15.5 14.5c-1 .7-1.5 1.5-1.5 2.5h-4c0-1-.5-1.8-1.5-2.5Z"/></>,
    person: <><circle cx="12" cy="8" r="3.5"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></>,
    building: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M11 21v-3h2v3"/></>,
    calendar: <><rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></>,
    check: <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></>,
    overview: <><path d="M7 5h13M7 12h13M7 19h13"/><circle cx="3.5" cy="5" r=".8" fill="currentColor"/><circle cx="3.5" cy="12" r=".8" fill="currentColor"/><circle cx="3.5" cy="19" r=".8" fill="currentColor"/></>,
    content: <><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v5h5M10 12h5M10 16h5"/></>,
    operations: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
    note: <><path d="M6 3h9l3 3v15H6z"/><path d="M14 3v4h4M9 11h6M9 15h5"/></>,
    task: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3V2h6v1M8.5 11.5l2 2 4.5-4.5M9 17h6"/></>,
    sks: <><path d="M12 3 20 6v6c0 5-3.2 8-8 10-4.8-2-8-5-8-10V6z"/><path d="m8.5 12 2.3 2.3 4.7-5"/></>,
    budget: <><circle cx="12" cy="12" r="9"/><path d="M15 8.5c-.7-.6-1.6-1-2.7-1-1.5 0-2.8.8-2.8 2s1 1.8 2.8 2.2c1.8.4 2.7 1 2.7 2.3s-1.2 2.3-2.9 2.3c-1.2 0-2.4-.4-3.2-1.2M12 5.5v13"/></>,
    decision: <><path d="m5 14 5 5L20 9"/><path d="M15 4 4 15v5h5L20 9z"/></>,
    report: <><path d="M6 3h9l3 3v15H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></>,
    link: <><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1"/></>,
    file: <><path d="M6 3h9l3 3v15H6z"/><path d="M14 3v4h4"/><path d="m9 15 2-2 2 2 2-3 2 4H9z"/></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    edit: <><path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10z"/><path d="m14.5 7.5 3 3"/></>,
  }
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>{paths[name]}</svg>
}

function EventIconBadge({ name, tone = 'brand', className = '' }: { name: EventVisualIcon; tone?: 'brand' | 'accent' | 'sky' | 'violet'; className?: string }) {
  const tones = {
    brand: 'bg-brand-soft text-brand-dark',
    accent: 'bg-accent-soft text-accent',
    sky: 'bg-sky-100 text-sky-700',
    violet: 'bg-violet-100 text-violet-700',
  }
  return <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]} ${className}`}><EventIcon name={name} /></span>
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
  onActivateTask: (taskId: string) => void
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
  onActivateTask,
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
  const [isDetailsOpen, setIsDetailsOpen] = useState(task.progressStatusSlug === 'completed')
  const [isAssigneesOpen, setIsAssigneesOpen] = useState(false)

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
  const activationStatusLabel = task.activationStatusSlug === 'active' ? 'Aktif' : 'Taslak'
  const priorityLabel = task.priority
    ? TASK_PRIORITY_LABELS[task.priority] ?? task.priority
    : 'Belirtilmemiş'
  const primaryAssigneeNames = task.assignees
    .filter((assignee) => assignee.assignmentType === 'primary')
    .map((assignee) => assignee.displayName)
  const assigneeGroups = ASSIGNMENT_TYPE_OPTIONS.map((option) => ({
    ...option,
    names: task.assignees
      .filter((assignee) => assignee.assignmentType === option.value)
      .map((assignee) => assignee.displayName),
  })).filter((group) => group.names.length > 0)
  const otherAssigneeCount = task.assignees.length - primaryAssigneeNames.length

  return (
    <div className={`rounded-xl border border-canvas-border px-3 py-3 transition-opacity sm:px-4 ${isDeactivated ? 'bg-canvas-surface opacity-80' : 'bg-canvas-surface'}`}>
      {isEditingTask ? (
        <div className="mb-4 overflow-hidden rounded-xl border border-canvas-border bg-canvas shadow-card">
          <div className="flex items-center justify-between gap-3 border-b border-canvas-border bg-canvas-surface px-4 py-3">
            <div className="flex items-center gap-3"><EventIconBadge name="task" /><div><h4 className="text-sm font-semibold text-ink">Görevi düzenle</h4><p className="mt-0.5 text-xs text-ink-soft">Görev bilgilerini ve zamanlamasını güncelleyin.</p></div></div>
            <button type="button" onClick={() => setIsEditingTask(false)} disabled={isUpdatingTaskInfo} aria-label="Görev düzenlemeyi kapat" className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-ink-soft hover:bg-canvas disabled:opacity-60">×</button>
          </div>
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-medium text-ink-soft sm:col-span-2">Görev adı<input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} disabled={isUpdatingTaskInfo} className="min-h-[44px] rounded-md border border-canvas-border bg-canvas-surface px-3 py-2 text-sm font-normal text-ink" /></label>
            <label className="grid gap-1.5 text-xs font-medium text-ink-soft sm:col-span-2">Açıklama<textarea value={editDescription} onChange={(event) => setEditDescription(event.target.value)} disabled={isUpdatingTaskInfo} rows={3} className="resize-y rounded-md border border-canvas-border bg-canvas-surface px-3 py-2 text-sm font-normal text-ink" /></label>
            <label className="grid gap-1.5 text-xs font-medium text-ink-soft">Son tarih<input type="datetime-local" value={editDeadline} onChange={(event) => setEditDeadline(event.target.value)} disabled={isUpdatingTaskInfo} className="min-h-[44px] rounded-md border border-canvas-border bg-canvas-surface px-3 py-2 text-sm font-normal text-ink" /></label>
            <label className="grid gap-1.5 text-xs font-medium text-ink-soft">Öncelik<select value={editPriority} onChange={(event) => setEditPriority(event.target.value)} disabled={isUpdatingTaskInfo} className="min-h-[44px] rounded-md border border-canvas-border bg-canvas-surface px-3 py-2 text-sm font-normal text-ink">{TASK_PRIORITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            {updateTaskInfoError ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 sm:col-span-2">{updateTaskInfoError}</p> : null}
          </div>
          <div className="flex flex-col gap-2 border-t border-canvas-border bg-canvas-surface px-4 py-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setIsEditingTask(false)} disabled={isUpdatingTaskInfo} className="min-h-[42px] rounded-md border border-canvas-border px-4 text-xs font-medium text-ink-soft disabled:opacity-60">İptal</button>
            <button type="button" onClick={() => void handleSaveTaskInfo()} disabled={isUpdatingTaskInfo} className="min-h-[42px] rounded-md bg-brand-dark px-5 text-xs font-medium text-white disabled:opacity-60">{isUpdatingTaskInfo ? 'Kaydediliyor…' : 'Kaydet'}</button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 gap-3">
              <EventIconBadge name="task" />
              <div className="min-w-0 flex flex-col gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-ink">{task.title}</span>
                {isDeactivated && (
                  <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                    Pasif görev
                  </span>
                )}
              </div>
              {task.description && <p className="line-clamp-2 whitespace-pre-wrap text-sm text-ink-soft underline decoration-dotted underline-offset-2">{task.description}</p>}
              </div>
            </div>
            <div className="flex max-w-full shrink-0 flex-wrap items-center justify-end gap-1 self-end sm:self-start">
              {task.activationStatusSlug !== 'active' && !isDeactivated ? (
                <span className="inline-flex min-h-[34px] items-center rounded-md border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-700">
                  {activationStatusLabel}
                </span>
              ) : null}
              {effectiveCanUpdateStatus ? (
                <select
                  value={task.progressStatusSlug ?? ''}
                  onChange={(event) => onUpdateStatus(task.id, event.target.value)}
                  disabled={isUpdatingStatus || availableTaskStatuses.length === 0}
                  className="min-h-[34px] w-fit rounded-md border border-green-200 bg-green-50 px-2 text-xs font-semibold text-green-800 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-60"
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
              ) : isDeactivated ? (
                <span className="inline-flex min-h-[34px] items-center rounded-md border border-canvas-border bg-canvas px-3 text-xs font-semibold text-ink-soft">
                  Pasif
                </span>
              ) : (
                <span className="inline-flex min-h-[34px] items-center rounded-md border border-canvas-border bg-canvas px-3 text-xs font-semibold text-ink-soft">
                  {statusLabel}
                </span>
              )}
              <button
                type="button"
                onClick={() => setIsDetailsOpen((open) => !open)}
                aria-expanded={isDetailsOpen}
                aria-label={isDetailsOpen ? 'Görev işlemlerini kapat' : 'Görev işlemlerini aç'}
                className="flex h-10 w-10 items-center justify-center rounded-md text-brand-dark hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <span aria-hidden="true" className={`text-lg transition-transform ${isDetailsOpen ? 'rotate-180' : ''}`}>⌄</span>
              </button>
            </div>
          </div>
          {updateStatusError && <p className="mt-2 text-xs text-red-600">{updateStatusError}</p>}
          <div className="mt-3 flex flex-col gap-1 pl-0 text-xs text-ink-soft sm:flex-row sm:flex-wrap sm:gap-4 sm:pl-[52px]">
            <span className="inline-flex items-center gap-1.5"><EventIcon name="calendar" className="h-3.5 w-3.5" /> Son tarih: {formatDeadline(task.deadlineAt)}</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" /> Öncelik: {priorityLabel}</span>
          </div>
        </>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft sm:pl-[52px]">
        <span className="inline-flex items-center gap-1.5"><EventIcon name="person" className="h-3.5 w-3.5" /> Ana sorumlu: {primaryAssigneeNames.length > 0 ? primaryAssigneeNames.join(', ') : 'Atanmamış'}</span>
        {otherAssigneeCount > 0 ? (
          <button
            type="button"
            onClick={() => setIsAssigneesOpen((open) => !open)}
            aria-expanded={isAssigneesOpen}
            className="inline-flex min-h-[40px] items-center rounded-md px-2 font-semibold text-brand-dark hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {isAssigneesOpen ? 'Atamaları gizle' : `+${otherAssigneeCount} diğer atama`}
          </button>
        ) : null}
      </div>

      {isAssigneesOpen && assigneeGroups.length > 0 ? (
        <div className="mt-2 grid gap-2 rounded-lg border border-canvas-border bg-canvas px-3 py-3 text-xs sm:ml-[52px] sm:grid-cols-3">
          {assigneeGroups.map((group) => (
            <div key={group.value} className="min-w-0">
              <p className="font-semibold text-ink-soft">{group.label}</p>
              <p className="mt-1 break-words leading-5 text-ink">{group.names.join(', ')}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className={isDetailsOpen ? 'mt-3' : 'hidden'}>
        <div className="flex flex-wrap gap-2 rounded-lg border border-canvas-border bg-canvas px-3 py-2">
          {effectiveCanUpdateStatus && (
            <button
              type="button"
              onClick={() => setIsEditingNote(true)}
              className="min-h-[40px] rounded-md border border-canvas-border bg-canvas-surface px-3 text-xs font-semibold text-ink-soft hover:text-brand-dark"
            >
              {task.notes ? 'Notu düzenle' : 'Not ekle'}
            </button>
          )}
          {effectiveCanManageAssignments && (
            <button
              type="button"
              onClick={onTogglePanel}
              className="min-h-[40px] rounded-md border border-canvas-border bg-canvas-surface px-3 text-xs font-semibold text-ink-soft hover:text-brand-dark"
            >
              {isPanelOpen ? 'Atamaları kapat' : 'Atama yönetimi'}
            </button>
          )}
          {effectiveCanEditTask && !isDeactivated && task.activationStatusSlug !== 'active' && (
            <button type="button" onClick={() => onActivateTask(task.id)} disabled={isProcessingActiveStatus} className="min-h-[40px] rounded-md border border-green-200 bg-green-50 px-3 text-xs font-semibold text-green-700 disabled:opacity-60">
              {isProcessingActiveStatus ? 'Aktifleştiriliyor…' : 'Aktifleştir'}
            </button>
          )}
          {effectiveCanEditTask && (
            <button type="button" onClick={startEditingTask} className="min-h-[40px] rounded-md border border-canvas-border bg-canvas-surface px-3 text-xs font-semibold text-ink-soft">Görevi düzenle</button>
          )}
          {isSuperAdmin && !isDeactivated && (
            <button type="button" onClick={() => onDeactivateTask(task.id)} disabled={isProcessingActiveStatus} className="min-h-[40px] rounded-md border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 disabled:opacity-60">Pasifleştir</button>
          )}
          {isSuperAdmin && isDeactivated && (
            <button type="button" onClick={() => onReactivateTask(task.id)} disabled={isProcessingActiveStatus} className="min-h-[40px] rounded-md border border-green-200 bg-green-50 px-3 text-xs font-semibold text-green-700 disabled:opacity-60">Yeniden aktifleştir</button>
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

      {(isEditingNote || Boolean(task.notes)) && (
        <div className="mt-3 overflow-hidden rounded-xl border border-canvas-border bg-canvas-surface shadow-card">
          <div className="flex items-center justify-between gap-3 border-b border-canvas-border px-4 py-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <EventIconBadge name="note" />
              <div className="min-w-0">
                <h5 className="text-sm font-semibold text-ink">Görev notu</h5>
                <p className="mt-0.5 text-xs text-ink-soft">Görevle ilgili güncel bilgi ve açıklamalar.</p>
              </div>
            </div>
            {effectiveCanUpdateStatus && !isEditingNote && task.notes ? (
              <button
                type="button"
                onClick={() => setIsEditingNote(true)}
                className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-brand/40 px-3 text-xs font-semibold text-brand-dark transition hover:bg-brand-soft"
              >
                <EventIcon name="edit" className="h-3.5 w-3.5" />
                Düzenle
              </button>
            ) : null}
          </div>

          {effectiveCanUpdateStatus && isEditingNote ? (
            <div className="p-4 sm:p-5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-soft" htmlFor={`task-note-${task.id}`}>
                Not
              </label>
              <textarea
                id={`task-note-${task.id}`}
                value={noteInputValue}
                onChange={(event) => setNoteInputValue(event.target.value)}
                disabled={isUpdatingNote}
                rows={5}
                className="mt-2 min-h-32 w-full resize-y rounded-xl border border-canvas-border bg-canvas px-3 py-3 text-sm leading-6 text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10 disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="Görevle ilgili notunuzu buraya yazın..."
              />
              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingNote(false)
                    setNoteInputValue(task.notes ?? '')
                  }}
                  disabled={isUpdatingNote}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-brand px-5 text-sm font-semibold text-brand-dark transition hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveNote()}
                  disabled={isUpdatingNote}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-brand-dark px-6 text-sm font-semibold text-white transition hover:bg-brand disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {isUpdatingNote ? 'Kaydediliyor…' : 'Notu kaydet'}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 sm:p-5">
              {task.notes ? (
                <div className="rounded-xl border border-brand/10 bg-brand-soft/20 px-4 py-3.5">
                  <p className="whitespace-pre-wrap text-sm leading-6 text-ink">{task.notes}</p>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-canvas-border bg-canvas px-4 py-7 text-center">
                  <p className="text-sm font-medium text-ink">Henüz görev notu yok</p>
                  <p className="mt-1 text-xs text-ink-soft">Görev işlemlerinden yeni bir not ekleyebilirsiniz.</p>
                </div>
              )}
            </div>
          )}

          {updateNoteError && (
            <p className="mx-4 mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:mx-5 sm:mb-5">
              {updateNoteError}
            </p>
          )}
          {updateNoteSuccess && !isEditingNote && (
            <p className="mx-4 mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 sm:mx-5 sm:mb-5">
              {updateNoteSuccess}
            </p>
          )}
        </div>
      )}

      {effectiveCanManageAssignments && isPanelOpen && (
        <div className="mt-3 overflow-hidden rounded-xl border border-canvas-border bg-canvas-surface shadow-card">
          <div className="flex items-center justify-between gap-3 border-b border-canvas-border px-4 py-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <EventIconBadge name="person" />
              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-ink">Atama yönetimi</h4>
                <p className="mt-0.5 text-xs text-ink-soft">Görevin sorumlularını ve bilgilendirilecek kişileri yönetin.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onTogglePanel}
              aria-label="Atama yönetimini kapat"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-canvas-border text-lg text-ink-soft transition hover:bg-canvas hover:text-ink"
            >
              ×
            </button>
          </div>

          <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <section className="rounded-xl border border-canvas-border bg-canvas p-4">
              <div className="mb-4">
                <h5 className="text-sm font-semibold text-ink">Yeni atama</h5>
                <p className="mt-1 text-xs text-ink-soft">Bir ekip üyesi ve sorumluluk türü seçin.</p>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-ink-soft" htmlFor={`assignee-select-${task.id}`}>
                    Üye
                  </label>
                  <select
                    id={`assignee-select-${task.id}`}
                    value={selectedProfileId}
                    onChange={(e) => onSelectedProfileIdChange(e.target.value)}
                    disabled={isAssigning || membersLoadState === 'loading'}
                    className="min-h-11 w-full rounded-lg border border-canvas-border bg-canvas-surface px-3 py-2.5 text-sm text-ink outline-none transition focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="">Üye seçin</option>
                    {members.map((member) => (
                      <option key={member.profileId} value={member.profileId}>
                        {member.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-ink-soft" htmlFor={`assignment-type-select-${task.id}`}>
                    Atama türü
                  </label>
                  <select
                    id={`assignment-type-select-${task.id}`}
                    value={selectedAssignmentType}
                    onChange={(e) => onSelectedAssignmentTypeChange(e.target.value)}
                    disabled={isAssigning}
                    className="min-h-11 w-full rounded-lg border border-canvas-border bg-canvas-surface px-3 py-2.5 text-sm text-ink outline-none transition focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
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
                  className="mt-1 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isAssigning ? 'Atanıyor…' : '+ Atama ekle'}
                </button>
              </div>

              {membersLoadState === 'loading' && (
                <p className="mt-3 text-sm text-ink-soft">Üyeler yükleniyor…</p>
              )}
              {membersLoadState === 'error' && (
                <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {PERIOD_MEMBERS_ERROR_MESSAGE}
                </p>
              )}
              {assignError && (
                <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {assignError}
                </p>
              )}
            </section>

            <section className="rounded-xl border border-canvas-border bg-canvas p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h5 className="text-sm font-semibold text-ink">Mevcut atamalar</h5>
                  <p className="mt-1 text-xs text-ink-soft">Göreve erişimi olan ekip üyeleri.</p>
                </div>
                <span className="rounded-full bg-canvas-surface px-2.5 py-1 text-xs font-semibold text-ink-soft">
                  {task.assignees.length}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {ASSIGNMENT_TYPE_OPTIONS.map((option) => (
                  <div key={option.value} className="rounded-lg border border-canvas-border bg-canvas-surface px-2 py-2.5 text-center">
                    <p className="text-lg font-semibold text-ink">
                      {task.assignees.filter((assignee) => assignee.assignmentType === option.value).length}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-ink-soft">{option.label}</p>
                  </div>
                ))}
              </div>

              {task.assignees.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-canvas-border bg-canvas-surface px-4 py-8 text-center">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand">
                    <EventIcon name="person" className="h-5 w-5" />
                  </div>
                  <p className="mt-3 text-sm font-medium text-ink">Henüz atama yok</p>
                  <p className="mt-1 text-xs text-ink-soft">Soldaki alandan ilk ekip üyesini ekleyebilirsiniz.</p>
                </div>
              ) : (
                <div className="mt-4 flex flex-col gap-2">
                  {task.assignees.map((assignee) => (
                    <div
                      key={assignee.id}
                      className="flex flex-col gap-3 rounded-xl border border-canvas-border bg-canvas-surface p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
                          {assignee.displayName.trim().charAt(0).toLocaleUpperCase('tr-TR') || '?'}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink">{assignee.displayName}</p>
                          <p className="mt-0.5 text-xs text-ink-soft">
                            {ASSIGNMENT_TYPE_LABELS[assignee.assignmentType] ?? assignee.assignmentType}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemove(assignee)}
                        disabled={removingAssignmentId === assignee.id}
                        className="inline-flex min-h-10 w-full shrink-0 items-center justify-center rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                      >
                        {removingAssignmentId === assignee.id ? 'Kaldırılıyor…' : 'Kaldır'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {removeError && (
                <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {removeError}
                </p>
              )}
            </section>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

export default function EventDetail() {
  const { eventId } = useParams<{ eventId: string }>()
  const { session } = useSession()
  const { displayName, hasActiveMembership, periodId, periodLabel, profileId, appRole, coordinatorRoleName, coordinatorRoleSlug, loading: statusLoading } =
    useMembershipStatus(session)
  const hasBudgetAccess = appRole === 'super_admin' || coordinatorRoleSlug === 'treasurer'
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [event, setEvent] = useState<EventBasicInfo | null>(null)
  const [statusLabel, setStatusLabel] = useState<string | null>(null)
  const [ownerName, setOwnerName] = useState<string | null>(null)
  const [ownerCoordinatorRoleName, setOwnerCoordinatorRoleName] = useState<string | null>(null)
  const [activeDetailTab, setActiveDetailTab] = useState<EventDetailTab>('overview')
  const [isEventDescriptionExpanded, setIsEventDescriptionExpanded] = useState(false)
  const [isSksSectionOpen, setIsSksSectionOpen] = useState(false)
  const [isBudgetSectionOpen, setIsBudgetSectionOpen] = useState(false)
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
  const [isDateEditorOpen, setIsDateEditorOpen] = useState(false)
  const [isSavingDates, setIsSavingDates] = useState(false)
  const [dateSaveError, setDateSaveError] = useState<string | null>(null)
  const [editEventStatus, setEditEventStatus] = useState('idea')
  const [editReportStatus, setEditReportStatus] = useState('no')
  const [editOwnerId, setEditOwnerId] = useState('')
  const [editingProcessField, setEditingProcessField] = useState<'venue' | 'nextAction' | null>(null)
  const [processFieldValue, setProcessFieldValue] = useState('')
  const [isSavingProcessField, setIsSavingProcessField] = useState(false)
  const [processFieldError, setProcessFieldError] = useState<string | null>(null)
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
  const [newTaskPrimaryProfileId, setNewTaskPrimaryProfileId] = useState('')
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
  const [availableEventDesignAnnouncementStatuses, setAvailableEventDesignAnnouncementStatuses] = useState<EventDesignAnnouncementStatusOption[]>([])
  const [availableEventAnnouncementStatuses, setAvailableEventAnnouncementStatuses] = useState<EventAnnouncementStatusOption[]>([])
  const [availableEventReportStatuses, setAvailableEventReportStatuses] = useState<EventReportStatusOption[]>([])
  const [availableEventStatuses, setAvailableEventStatuses] = useState<EventStatusOption[]>([])
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
  const [isUpdatingDesignAnnouncementStatus, setIsUpdatingDesignAnnouncementStatus] = useState(false)
  const [designAnnouncementStatusError, setDesignAnnouncementStatusError] = useState<string | null>(null)
  const [designAnnouncementStatusSuccess, setDesignAnnouncementStatusSuccess] = useState<string | null>(null)
  const [isDesignStatusEditorOpen, setIsDesignStatusEditorOpen] = useState(false)
  const [designStatusDraft, setDesignStatusDraft] = useState('not_required')
  const [isAnnouncementStatusEditorOpen, setIsAnnouncementStatusEditorOpen] = useState(false)
  const [announcementStatusDraft, setAnnouncementStatusDraft] = useState('not_required')
  const [isUpdatingAnnouncementStatus, setIsUpdatingAnnouncementStatus] = useState(false)
  const [announcementStatusError, setAnnouncementStatusError] = useState<string | null>(null)
  const [announcementStatusSuccess, setAnnouncementStatusSuccess] = useState<string | null>(null)

  // Budget State
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
    if (!editingProcessField) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === 'Escape' && !isSavingProcessField) {
        setEditingProcessField(null)
        setProcessFieldValue('')
        setProcessFieldError(null)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [editingProcessField, isSavingProcessField])

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
        .select('title, description, event_status, sks_status, design_announcement_status, report_status, planning_date, preparation_start_date, estimated_date, confirmed_date, owner_id, venue, next_action, general_note')
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
      type EventBudgetData = { budget_status: string | null; estimated_budget: number | null; approved_budget: number | null; actual_expense: number | null; budget_note: string | null }
      let budgetData: EventBudgetData | null = null
      if (hasBudgetAccess) {
        const { data: loadedBudget, error: budgetError } = await supabase
          .rpc('get_event_budget', { target_event_id: eventId })
          .maybeSingle()
        if (!budgetError) {
          budgetData = loadedBudget as EventBudgetData | null
        }
      }
      setEvent({
        title: data.title as string,
        description: (data.description as string | null) ?? null,
        eventStatus,
        sksStatus: (data.sks_status as string | null) ?? null,
        budgetStatus: budgetData?.budget_status ?? null,
        designAnnouncementStatus: (data.design_announcement_status as string | null) ?? 'not_required',
        announcementStatus: 'not_required',
        reportStatus: (data.report_status as string | null) ?? 'no',
        estimatedBudget: parseNullableNumber(budgetData?.estimated_budget),
        approvedBudget: parseNullableNumber(budgetData?.approved_budget),
        actualExpense: parseNullableNumber(budgetData?.actual_expense),
        budgetNote: budgetData?.budget_note ?? null,
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

      const { data: announcementData } = await supabase
        .from('events')
        .select('announcement_status')
        .eq('id', eventId)
        .eq('period_id', periodId)
        .is('deleted_at', null)
        .maybeSingle()

      if (!isMounted) return
      if (announcementData) {
        setEvent((current) => current ? {
          ...current,
          announcementStatus: (announcementData.announcement_status as string | null) ?? 'not_required',
        } : current)
      }

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
          .from('period_memberships')
          .select('period_display_name, coordinator_roles(name)')
          .eq('period_id', periodId)
          .eq('profile_id', ownerId)
          .maybeSingle()

        if (!isMounted) return
        setOwnerName((ownerData?.period_display_name as string | null) ?? null)
        const ownerRoleRelation = ownerData?.coordinator_roles as { name?: string } | { name?: string }[] | null | undefined
        const ownerRole = Array.isArray(ownerRoleRelation) ? ownerRoleRelation[0] : ownerRoleRelation
        setOwnerCoordinatorRoleName(ownerRole?.name ?? null)
      } else {
        setOwnerName(null)
        setOwnerCoordinatorRoleName(null)
      }
    }

    void loadEvent()
    return () => {
      isMounted = false
    }
  }, [hasBudgetAccess, hasActiveMembership, periodId, eventId, statusLoading])

  useEffect(() => {
    if (statusLoading || !hasActiveMembership || !eventId || !periodId) return
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
          .from('period_memberships')
          .select('profile_id, period_display_name')
          .eq('period_id', periodId)
          .in('profile_id', profileIds)

        if (!isMounted) return
        for (const profileRow of profileRows ?? []) {
          profileNameMap[profileRow.profile_id as string] = (profileRow.period_display_name as string | null) ?? 'İsimsiz üye'
        }
      }

      setProcessMembers((memberRows ?? []).filter((row) => hasBudgetAccess || row.process_type !== 'budget').map((row) => ({
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
  }, [hasBudgetAccess, hasActiveMembership, eventId, periodId, statusLoading, processMembersRefreshKey])

  useEffect(() => {
    if (!isEditingGeneralNote && event) {
      setGeneralNoteInputValue(event.generalNote ?? '')
    }
  }, [event, isEditingGeneralNote])

  useEffect(() => {
    if (statusLoading || !hasActiveMembership) return
    let isMounted = true

    async function loadReferenceData() {
      const [
        { data: taskData },
        { data: sksData },
        { data: budgetData },
        { data: designAnnouncementData },
        { data: announcementData },
        { data: reportStatusData },
        { data: eventStatusData },
      ] = await Promise.all([
        supabase.from('task_progress_statuses').select('slug, label').order('sort_order', { ascending: true }),
        supabase.from('sks_statuses').select('slug, label').order('sort_order', { ascending: true }),
        hasBudgetAccess ? supabase.from('budget_statuses').select('slug, label').order('sort_order', { ascending: true }) : Promise.resolve({ data: [] }),
        supabase.from('event_design_announcement_statuses').select('slug, label').order('sort_order', { ascending: true }),
        supabase.from('event_announcement_statuses').select('slug, label').order('sort_order', { ascending: true }),
        supabase.from('event_report_statuses').select('slug, label').order('sort_order', { ascending: true }),
        supabase.from('event_statuses').select('slug, label').order('sort_order', { ascending: true }),
      ])

      if (!isMounted) return
      setAvailableTaskStatuses((taskData ?? []) as TaskProgressStatusOption[])
      setAvailableSksStatuses((sksData ?? []) as SksStatusOption[])
      setAvailableBudgetStatuses((budgetData ?? []) as BudgetStatusOption[])
      setAvailableEventDesignAnnouncementStatuses((designAnnouncementData ?? []) as EventDesignAnnouncementStatusOption[])
      setAvailableEventAnnouncementStatuses((announcementData ?? []) as EventAnnouncementStatusOption[])
      setAvailableEventReportStatuses((reportStatusData ?? []) as EventReportStatusOption[])
      setAvailableEventStatuses((eventStatusData ?? []) as EventStatusOption[])
    }

    void loadReferenceData()
    return () => {
      isMounted = false
    }
  }, [hasBudgetAccess, hasActiveMembership, statusLoading])

  useEffect(() => {
    if (statusLoading) return
    if (!hasActiveMembership || !eventId || !periodId) {
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
        .select('id, title, description, activation_status, progress_status, deadline_at, priority, notes, deleted_at')
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
        activationStatusSlug: (row.activation_status as string) ?? 'draft',
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
          .from('period_memberships')
          .select('profile_id, period_display_name')
          .eq('period_id', periodId)
          .in('profile_id', profileIds)

        if (!isMounted) return
        for (const profileRow of profileRows ?? []) {
          profileNameMap[profileRow.profile_id as string] = (profileRow.period_display_name as string | null) ?? 'İsimsiz üye'
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
  }, [hasActiveMembership, eventId, periodId, statusLoading, tasksRefreshKey, appRole, showInactiveTasks])

  useEffect(() => {
    if (statusLoading || !hasActiveMembership || !eventId || !periodId) return
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
        const { data: profilesData } = await supabase
          .from('period_memberships')
          .select('profile_id, period_display_name')
          .eq('period_id', periodId)
          .in('profile_id', creatorIds)
        if (profilesData) {
          for (const p of profilesData) {
            profileMap[p.profile_id] = p.period_display_name
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
  }, [hasActiveMembership, eventId, periodId, statusLoading, decisionsRefreshKey, showInactiveDecisions])

  useEffect(() => {
    if (statusLoading || !hasActiveMembership || !eventId || !periodId) return
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
        const { data: profilesData } = await supabase
          .from('period_memberships')
          .select('profile_id, period_display_name')
          .eq('period_id', periodId)
          .in('profile_id', creatorIds)
        if (profilesData) {
          for (const p of profilesData) {
            profileMap[p.profile_id] = p.period_display_name
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
  }, [hasActiveMembership, eventId, periodId, statusLoading, reportsRefreshKey, showInactiveReports])

  useEffect(() => {
    if (statusLoading || !hasActiveMembership || !eventId || !periodId) return
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
        const { data: profilesData } = await supabase
          .from('period_memberships')
          .select('profile_id, period_display_name')
          .eq('period_id', periodId)
          .in('profile_id', creatorIds)
        if (profilesData) {
          for (const p of profilesData) {
            profileMap[p.profile_id] = p.period_display_name
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
  }, [hasActiveMembership, eventId, periodId, statusLoading, linksRefreshKey, showInactiveLinks])

  useEffect(() => {
    if (statusLoading || !hasActiveMembership || !eventId || !periodId) return
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
        const { data: profilesData } = await supabase
          .from('period_memberships')
          .select('profile_id, period_display_name')
          .eq('period_id', periodId)
          .in('profile_id', uploaderIds)
        if (profilesData) {
          for (const p of profilesData) {
            profileMap[p.profile_id] = p.period_display_name
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
  }, [hasActiveMembership, eventId, periodId, statusLoading, filesRefreshKey, showInactiveFiles])

  useEffect(() => {
    if (statusLoading || !hasActiveMembership || !eventId || !periodId || !hasBudgetAccess) {
      setSponsors([])
      setSponsorsLoadState('idle')
      return
    }
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
        const { data: profilesData } = await supabase
          .from('period_memberships')
          .select('profile_id, period_display_name')
          .eq('period_id', periodId)
          .in('profile_id', creatorIds)
        if (profilesData) {
          for (const p of profilesData) {
            profileMap[p.profile_id] = p.period_display_name
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
  }, [hasBudgetAccess, hasActiveMembership, eventId, periodId, statusLoading, sponsorsRefreshKey, showInactiveSponsors])

  function openTaskForm() {
    setNewTaskTitle('')
    setNewTaskDescription('')
    setNewTaskDeadline('')
    setNewTaskPriority('normal')
    setNewTaskPrimaryProfileId('')
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
    const { data: createdTask, error } = await supabase.from('tasks').insert({
      period_id: periodId,
      event_id: eventId,
      title: trimmedTitle,
      description: trimmedDescription || null,
      created_by: profileId,
      activation_status: 'active',
      deadline_at: deadlineAt,
      priority: newTaskPriority,
    }).select('id').single()

    if (error || !createdTask) {
      setIsCreatingTask(false)
      setCreateTaskError(TASK_CREATE_ERROR_MESSAGE)
      return
    }

    if (newTaskPrimaryProfileId) {
      const { error: assignmentError } = await supabase.from('task_assignees').insert({
        task_id: createdTask.id as string,
        profile_id: newTaskPrimaryProfileId,
        assignment_type: 'primary',
        assigned_by: profileId,
      })

      if (assignmentError) {
        setIsCreatingTask(false)
        setIsTaskFormOpen(false)
        setNewTaskTitle('')
        setNewTaskDescription('')
        setNewTaskDeadline('')
        setNewTaskPriority('normal')
        setNewTaskPrimaryProfileId('')
        setTaskSuccessMessage('Görev oluşturuldu ancak koordinatör ataması kaydedilemedi. Görev kartındaki Atama yönetimi alanından tekrar deneyin.')
        setTasksRefreshKey((current) => current + 1)
        return
      }
    }

    setIsCreatingTask(false)

    setIsTaskFormOpen(false)
    setNewTaskTitle('')
    setNewTaskDescription('')
    setNewTaskDeadline('')
    setNewTaskPriority('normal')
    setNewTaskPrimaryProfileId('')
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

  async function handleActivateTask(taskId: string) {
    if (!profileId || !canEdit) return

    setProcessingActiveStatusTaskId(taskId)
    const { error } = await supabase
      .from('tasks')
      .update({ activation_status: 'active' })
      .eq('id', taskId)

    setProcessingActiveStatusTaskId(null)
    if (error) {
      setTaskSuccessMessage('Görev aktifleştirilemedi.')
      return
    }

    setTaskSuccessMessage('Görev aktifleştirildi ve takvime eklenebilir.')
    setTasksRefreshKey((current) => current + 1)
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

  async function handleUpdateDesignAnnouncementStatus(newSlug: string): Promise<boolean> {
    if (!profileId || !eventId) return false
    setIsUpdatingDesignAnnouncementStatus(true)
    setDesignAnnouncementStatusError(null)
    setDesignAnnouncementStatusSuccess(null)

    const { error } = await supabase.from('events').update({ design_announcement_status: newSlug }).eq('id', eventId)
    setIsUpdatingDesignAnnouncementStatus(false)
    if (error) {
      setDesignAnnouncementStatusError(error.message.includes('kilitli')
        ? 'Dönem kilitli olduğu için bu işlemi gerçekleştiremezsiniz.'
        : error.code === '42501' || error.message.includes('yetkiniz')
          ? 'Tasarım durumunu değiştirme yetkiniz bulunmuyor.'
          : 'Tasarım durumu güncellenirken bir hata oluştu.')
      return false
    }

    setDesignAnnouncementStatusSuccess('Tasarım durumu başarıyla güncellendi.')
    setEvent((previous) => (previous ? { ...previous, designAnnouncementStatus: newSlug } : previous))
    return true
  }

  function openDesignStatusEditing() {
    if (!event) return
    setDesignStatusDraft(event.designAnnouncementStatus)
    setDesignAnnouncementStatusError(null)
    setDesignAnnouncementStatusSuccess(null)
    setIsDesignStatusEditorOpen(true)
  }

  async function handleSaveDesignStatus() {
    const saved = await handleUpdateDesignAnnouncementStatus(designStatusDraft)
    if (saved) setIsDesignStatusEditorOpen(false)
  }

  function openAnnouncementStatusEditing() {
    if (!event) return
    setAnnouncementStatusDraft(event.announcementStatus)
    setAnnouncementStatusError(null)
    setAnnouncementStatusSuccess(null)
    setIsAnnouncementStatusEditorOpen(true)
  }

  async function handleSaveAnnouncementStatus() {
    if (!profileId || !eventId) return
    setIsUpdatingAnnouncementStatus(true)
    setAnnouncementStatusError(null)
    setAnnouncementStatusSuccess(null)

    const { error } = await supabase.from('events').update({ announcement_status: announcementStatusDraft }).eq('id', eventId)
    setIsUpdatingAnnouncementStatus(false)

    if (error) {
      setAnnouncementStatusError(error.message.includes('kilitli')
        ? 'Dönem kilitli olduğu için bu işlemi gerçekleştiremezsiniz.'
        : error.code === '42501' || error.message.includes('yetkiniz')
          ? 'Duyuru / Yayın durumunu değiştirme yetkiniz bulunmuyor.'
          : 'Duyuru / Yayın durumu güncellenirken bir hata oluştu.')
      return
    }

    setAnnouncementStatusSuccess('Duyuru / Yayın durumu başarıyla güncellendi.')
    setEvent((previous) => (previous ? { ...previous, announcementStatus: announcementStatusDraft } : previous))
    setIsAnnouncementStatusEditorOpen(false)
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
  const [isCoCoordinator, setIsCoCoordinator] = useState(false)

  useEffect(() => {
    if (!eventId || !profileId) {
      setIsCoCoordinator(false)
      return
    }
    let isMounted = true
    async function loadCoCoordinatorStatus() {
      const { data } = await supabase
        .from('event_coordinators')
        .select('id')
        .eq('event_id', eventId)
        .eq('profile_id', profileId)
        .maybeSingle()
      if (isMounted) setIsCoCoordinator(Boolean(data))
    }
    void loadCoCoordinatorStatus()
    return () => {
      isMounted = false
    }
  }, [eventId, profileId])

  const canEdit = isOwner || isSuperAdmin || isCoCoordinator

  const sksMembers = processMembers.filter(m => m.processType === 'sks')
  const sksOwner = sksMembers.find((member) => member.responsibilityType === 'owner')
  const isSksOwner = sksOwner?.profileId === profileId
  const canChangeSksStatus = isSuperAdmin || isSksOwner
  const canManageSksTeam = isSuperAdmin || isOwner || isSksOwner
  const isDesignOwner = processMembers.some(
    (member) => member.processType === 'design'
      && member.profileId === profileId
      && member.responsibilityType === 'owner',
  )
  const isPressOwner = processMembers.some(
    (member) => member.processType === 'press'
      && member.profileId === profileId
      && member.responsibilityType === 'owner',
  )
  const canChangeDesignAnnouncementStatus = isSuperAdmin || isDesignOwner
  const canChangeAnnouncementStatus = isSuperAdmin || isPressOwner

  const canChangeBudgetFields = hasBudgetAccess

  useEffect(() => {
    if ((!canEdit && !hasBudgetAccess) || !periodId) {
      setPeriodMembers([])
      setPeriodMembersLoadState('idle')
      return
    }

    let isMounted = true
    async function loadPeriodMembers() {
      setPeriodMembersLoadState('loading')
      const { data: membershipRows, error: membershipError } = await supabase
        .from('period_memberships')
        .select('profile_id, period_display_name, coordinator_roles(name, slug)')
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

      const membershipRoleByProfileId = new Map<string, string | null>()
      for (const membership of membershipRows ?? []) {
        const relation = membership.coordinator_roles as { name?: string; slug?: string } | { name?: string; slug?: string }[] | null | undefined
        const role = Array.isArray(relation) ? relation[0] : relation
        membershipRoleByProfileId.set(membership.profile_id as string, role?.slug ?? null)
      }

      setPeriodMembers(
        (membershipRows ?? []).map((row) => ({
          profileId: row.profile_id as string,
          displayName: (row.period_display_name as string | null) ?? 'İsimsiz üye',
          coordinatorRoleSlug: membershipRoleByProfileId.get(row.profile_id as string) ?? null,
          coordinatorRoleName: (() => {
            const relation = row.coordinator_roles as { name?: string } | { name?: string }[] | null | undefined
            return (Array.isArray(relation) ? relation[0] : relation)?.name ?? null
          })(),
        })),
      )
      setPeriodMembersLoadState('ready')
    }

    void loadPeriodMembers()
    return () => {
      isMounted = false
    }
  }, [canEdit, hasBudgetAccess, periodId])

  useEffect(() => {
    if (sksMembers.some((member) => member.responsibilityType === 'owner')) return
    const generalSecretary = periodMembers.find((member) => member.coordinatorRoleSlug === 'general-secretary')
    if (generalSecretary) {
      setSksSelectedProfileId(generalSecretary.profileId)
      setSksSelectedResponsibility('owner')
    }
  }, [periodMembers, sksMembers])

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
    setEditEventStatus(event.eventStatus ?? 'idea')
    setEditReportStatus(event.reportStatus)
    setEditOwnerId(event.ownerId ?? '')
    setSaveError(null)
    setSuccessMessage(null)
    setIsEditing(true)
  }

  function openDateEditing() {
    if (!event) return
    setEditPlanningDate(extractDateOnly(event.planningDate))
    setEditPreparationStartDate(extractDateOnly(event.preparationStartDate))
    setEditEstimatedDate(extractDateOnly(event.estimatedDate))
    setEditConfirmedDate(extractDateOnly(event.confirmedDate))
    setDateSaveError(null)
    setIsDateEditorOpen(true)
  }

  function closeDateEditing() {
    if (isSavingDates) return
    setIsDateEditorOpen(false)
    setDateSaveError(null)
  }

  async function handleSaveDates() {
    if (!eventId || !periodId) return
    setIsSavingDates(true)
    setDateSaveError(null)

    const nextPlanningDate = editPlanningDate || null
    const nextPreparationStartDate = editPreparationStartDate || null
    const nextEstimatedDate = editEstimatedDate || null
    const nextConfirmedDate = editConfirmedDate || null

    const { data, error } = await supabase
      .from('events')
      .update({
        planning_date: nextPlanningDate,
        preparation_start_date: nextPreparationStartDate,
        estimated_date: nextEstimatedDate,
        confirmed_date: nextConfirmedDate,
      })
      .eq('id', eventId)
      .eq('period_id', periodId)
      .is('deleted_at', null)
      .select('planning_date, preparation_start_date, estimated_date, confirmed_date')
      .maybeSingle()

    setIsSavingDates(false)

    if (error || !data) {
      setDateSaveError(error?.message.includes('kilitli')
        ? 'Dönem kilitli olduğu için tarihler güncellenemiyor.'
        : 'Tarihler güncellenirken bir hata oluştu.')
      return
    }

    setEvent((current) => current ? {
      ...current,
      planningDate: data.planning_date as string | null,
      preparationStartDate: data.preparation_start_date as string | null,
      estimatedDate: data.estimated_date as string | null,
      confirmedDate: data.confirmed_date as string | null,
    } : current)
    setIsDateEditorOpen(false)
    setSuccessMessage('Etkinlik tarihleri güncellendi.')
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
      setEditEventStatus(event.eventStatus ?? 'idea')
      setEditReportStatus(event.reportStatus)
      setEditOwnerId(event.ownerId ?? '')
    }
  }

  function openProcessFieldEditing(field: 'venue' | 'nextAction') {
    if (!event) return
    setIsEditing(false)
    setEditingProcessField(field)
    setProcessFieldValue(field === 'venue' ? event.venue ?? '' : event.nextAction ?? '')
    setProcessFieldError(null)
    setSuccessMessage(null)
  }

  function closeProcessFieldEditing() {
    if (isSavingProcessField) return
    setEditingProcessField(null)
    setProcessFieldValue('')
    setProcessFieldError(null)
  }

  async function handleSaveProcessField() {
    if (!eventId || !periodId || !event || !editingProcessField) return
    const column = editingProcessField === 'venue' ? 'venue' : 'next_action'
    const nextValue = processFieldValue.trim() || null
    setIsSavingProcessField(true)
    setProcessFieldError(null)

    const { data, error } = await supabase
      .from('events')
      .update({ [column]: nextValue })
      .eq('id', eventId)
      .eq('period_id', periodId)
      .is('deleted_at', null)
      .select(column)
      .maybeSingle()

    setIsSavingProcessField(false)
    if (error) {
      setProcessFieldError(error.message || 'Değişiklik kaydedilirken bir hata oluştu.')
      return
    }
    if (!data) {
      setProcessFieldError('Değişiklik kaydedilemedi. Lütfen tekrar deneyin.')
      return
    }

    const savedValue =
      editingProcessField === 'venue'
        ? (data as { venue: string | null }).venue
        : (data as { next_action: string | null }).next_action
    setEvent((current) =>
      current
        ? {
            ...current,
            ...(editingProcessField === 'venue' ? { venue: savedValue } : { nextAction: savedValue }),
          }
        : current,
    )
    setSuccessMessage(editingProcessField === 'venue' ? 'Mekân güncellendi.' : 'Sonraki işlem güncellendi.')
    setEditingProcessField(null)
    setProcessFieldValue('')
  }

  async function handleSave() {
    if (!eventId || !periodId || !event) return
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

    if (isSuperAdmin && !editOwnerId) {
      setIsSaving(false)
      setSaveError('Etkinlik sorumlusu seçilmelidir.')
      return
    }

    const updatePayload = {
      title: trimmedTitle,
      description: nextDescription,
      planning_date: nextPlanningDate,
      preparation_start_date: nextPreparationStartDate,
      estimated_date: nextEstimatedDate,
      confirmed_date: nextConfirmedDate,
      event_status: editEventStatus,
      report_status: editReportStatus,
      ...(isSuperAdmin ? { owner_id: editOwnerId } : {}),
    }

    const { data, error } = await supabase
      .from('events')
      .update(updatePayload)
      .eq('id', eventId)
      .eq('period_id', periodId)
      .is('deleted_at', null)
      .select('title, description, event_status, planning_date, preparation_start_date, estimated_date, confirmed_date, report_status, owner_id')
      .maybeSingle()

    setIsSaving(false)

    if (error) {
      setSaveError(error.message || 'Değişiklikler kaydedilirken bir hata oluştu.')
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
            eventStatus: (data.event_status as string | null) ?? editEventStatus,
            planningDate: (data.planning_date as string | null) ?? nextPlanningDate,
            preparationStartDate: data.preparation_start_date as string | null,
            estimatedDate: (data.estimated_date as string | null) ?? nextEstimatedDate,
            confirmedDate: (data.confirmed_date as string | null) ?? nextConfirmedDate,
            reportStatus: (data.report_status as string | null) ?? editReportStatus,
            ownerId: (data.owner_id as string | null) ?? event.ownerId,
          }
        : current,
    )
    const savedOwnerId = (data.owner_id as string | null) ?? event.ownerId
    const savedOwner = periodMembers.find((member) => member.profileId === savedOwnerId)
    setOwnerName(savedOwner?.displayName ?? ownerName)
    setOwnerCoordinatorRoleName(savedOwner?.coordinatorRoleName ?? ownerCoordinatorRoleName)
    setStatusLabel(availableEventStatuses.find((status) => status.slug === ((data.event_status as string | null) ?? editEventStatus))?.label ?? null)
    setIsEditing(false)
    setSuccessMessage('Etkinlik başarıyla güncellendi.')
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  if (statusLoading || loadState === 'loading') return <CenteredMessage text="Etkinlik yükleniyor…" />
  if (!hasActiveMembership) return <CenteredMessage text="Bu sayfaya erişim yetkin yok." />
  if (loadState === 'error') return <CenteredMessage text="Etkinlik yüklenirken bir hata oluştu." />
  if (loadState === 'not_found' || !event || !eventId) return <CenteredMessage text="Etkinlik bulunamadı." />

  const displayedStatus = statusLabel ?? event.eventStatus ?? 'Durum belirtilmemiş'
  const displayedOwner = event.ownerId ? ownerName ?? NOT_SPECIFIED : NOT_SPECIFIED
  const displayedVenue = event.venue || NOT_SPECIFIED
  const canExpandEventDescription =
    !!event.description &&
    (event.description.length > 120 || event.description.split(/\r?\n/).length > 2)
  const openTasks = tasks.filter(
    (task) => !task.deletedAt && task.progressStatusSlug !== 'completed' && task.progressStatusSlug !== 'cancelled',
  )
  const openTaskCount = openTasks.length
  const nextOpenTask = [...openTasks].sort((a, b) => {
    if (!a.deadlineAt && !b.deadlineAt) return 0
    if (!a.deadlineAt) return 1
    if (!b.deadlineAt) return -1
    return new Date(a.deadlineAt).getTime() - new Date(b.deadlineAt).getTime()
  })[0] ?? null
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const upcomingEventDate = [
    { label: 'Hazırlık başlangıcı', value: event.preparationStartDate },
    { label: 'Tahmini etkinlik tarihi', value: event.estimatedDate },
    { label: 'Kesinleşmiş tarih', value: event.confirmedDate },
  ]
    .filter((item): item is { label: string; value: string } => Boolean(item.value))
    .map((item) => ({ ...item, time: new Date(`${item.value}T00:00:00`).getTime() }))
    .filter((item) => Number.isFinite(item.time) && item.time >= todayStart.getTime())
    .sort((a, b) => a.time - b.time)[0] ?? null

  const treasurerMember = periodMembers.find((member) => member.coordinatorRoleSlug === 'treasurer')
  const remainingBudget = event.approvedBudget === null ? null : event.approvedBudget - (event.actualExpense ?? 0)
  const activeSponsors = sponsors.filter((sponsor) => !sponsor.deletedAt)
  const sponsorTotal = activeSponsors.reduce((total, sponsor) => total + sponsor.amount, 0)
  const roleLabel = coordinatorRoleName ?? (isSuperAdmin ? 'Süper Yönetici' : 'Koordinatör')
  const primaryDate = event.confirmedDate ?? event.estimatedDate

  return (
    <AppShell
      isSuperAdmin={isSuperAdmin}
      displayName={displayName}
      roleLabel={roleLabel}
      onSignOut={() => void handleSignOut()}
    >
      <main className="mx-auto max-w-[1220px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Link
          to="/app/etkinlikler"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-md text-sm font-medium text-brand-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <span aria-hidden="true">←</span>
          Etkinliklere dön
        </Link>

        <section id="event-overview" className="mt-3 overflow-hidden rounded-xl border border-canvas-border bg-canvas-surface shadow-card">
          <div className="p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="break-words text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{event.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">{displayedStatus}</span>
                <p className="text-sm text-ink-soft">Aktif dönem: <span className="font-semibold text-brand-dark">{periodLabel ?? 'Belirtilmedi'}</span></p>
              </div>
              <p
                id="event-description-summary"
                className={`mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-ink-soft ${isEventDescriptionExpanded ? '' : 'line-clamp-2'}`}
              >
                {event.description || 'Etkinlik açıklaması eklenmemiş.'}
              </p>
              {canExpandEventDescription ? (
                <button
                  type="button"
                  onClick={() => setIsEventDescriptionExpanded((expanded) => !expanded)}
                  aria-expanded={isEventDescriptionExpanded}
                  aria-controls="event-description-summary"
                  className="mt-1 inline-flex min-h-[40px] items-center rounded-md pr-2 text-xs font-semibold text-brand-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {isEventDescriptionExpanded ? 'Kısalt' : 'Devamını göster'}
                </button>
              ) : null}
            </div>
            {canEdit && !isEditing && (
              <button
                type="button"
                onClick={startEditing}
                className="flex min-h-[44px] w-full shrink-0 items-center justify-center gap-2 rounded-md border border-brand/50 bg-canvas-surface px-4 text-sm font-semibold text-brand-dark hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:w-auto"
              >
                <EventIcon name="edit" className="h-4 w-4" />
                Etkinliği düzenle
              </button>
            )}
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-0 border-t border-canvas-border pt-5 lg:grid-cols-5">
            {([
              ['status', 'Etkinlik durumu', displayedStatus, 'accent'],
              ['person', 'Sorumlu', displayedOwner, 'brand'],
              ['building', 'Koordinatörlük', ownerCoordinatorRoleName ?? NOT_SPECIFIED, 'brand'],
              ['calendar', event.confirmedDate ? 'Kesin tarih' : 'Tahmini tarih', formatDate(primaryDate), 'accent'],
              ['check', 'Açık görev', String(openTaskCount), 'brand'],
            ] as const).map(([icon, label, value, tone], index) => (
              <div key={label} className={`flex min-w-0 items-center gap-3 py-3 sm:px-4 lg:py-0 ${index === 4 ? 'col-span-2 lg:col-span-1' : ''} ${index > 0 ? 'lg:border-l lg:border-canvas-border' : ''}`}>
                <EventIconBadge name={icon} tone={tone} />
                <div className="min-w-0">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{label}</dt>
                  <dd className="mt-0.5 break-words text-sm font-semibold text-ink">{value}</dd>
                </div>
              </div>
            ))}
          </dl>

          </div>
        </section>

        <nav className="sticky top-16 z-20 -mx-4 mt-4 overflow-x-auto border-y border-canvas-border bg-canvas-surface/95 backdrop-blur lg:top-0 lg:mx-0 lg:rounded-xl lg:border" aria-label="Etkinlik detay bölümleri">
          <div className="grid min-w-[330px] grid-cols-3" role="tablist">
            {([
              ['overview', 'Genel Bakış', 'overview'],
              ['content', 'İçerikler', 'content'],
              ['operations', 'Operasyon', 'operations'],
            ] as const).map(([tab, label, icon]) => {
              const isActive = activeDetailTab === tab
              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => {
                    setActiveDetailTab(tab)
                  }}
                  className={`flex min-h-[54px] items-center justify-center gap-1.5 border-r border-canvas-border px-2 text-xs font-semibold transition-colors last:border-r-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:gap-2 sm:px-4 sm:text-sm ${isActive ? 'bg-brand-dark text-white' : 'text-ink-soft hover:bg-brand-soft hover:text-brand-dark'}`}
                >
                  <EventIcon name={icon} className="h-4 w-4" />
                  {label}
                </button>
              )
            })}
          </div>
        </nav>

        {successMessage && !isEditing && (
          <p className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            {successMessage}
          </p>
        )}

        {isEditing ? (
          <div id="event-edit-form" className="mt-6 scroll-mt-28 overflow-hidden rounded-2xl border border-canvas-border bg-canvas-surface shadow-card">
            <div className="flex items-center justify-between gap-4 border-b border-canvas-border px-4 py-4 sm:px-6">
              <div className="flex items-center gap-3"><EventIconBadge name="calendar" /><div><h2 className="text-lg font-semibold text-ink">Etkinliği düzenle</h2><p className="mt-0.5 text-xs text-ink-soft">Etkinlik bilgilerini güncelleyin ve yönetin.</p></div></div>
              <button type="button" onClick={cancelEditing} disabled={isSaving} aria-label="Düzenleme penceresini kapat" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl text-ink-soft hover:bg-canvas disabled:opacity-60">×</button>
            </div>

            <div className="p-4 sm:p-6">
              <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
                {([
                  ['status', 'Durum', availableEventStatuses.find((status) => status.slug === editEventStatus)?.label ?? editEventStatus],
                  ['calendar', 'Planlama', formatDate(editPlanningDate || null)],
                  ['status', 'Tahmini tarih', formatDate(editEstimatedDate || null)],
                  ['person', 'Sorumlu', periodMembers.find((member) => member.profileId === editOwnerId)?.displayName ?? displayedOwner],
                ] as const).map(([icon, label, value]) => <div key={label} className="flex min-h-[84px] items-center gap-3 rounded-xl border border-canvas-border bg-canvas p-3 sm:p-4"><EventIconBadge name={icon} /><div className="min-w-0"><p className="text-xs font-medium text-ink-soft">{label}</p><p className="mt-1 truncate text-sm font-semibold text-ink sm:text-base">{value}</p></div></div>)}
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(17rem,0.75fr)]">
                <div className="space-y-4">
                  <section className="rounded-xl border border-canvas-border p-4 sm:p-5">
                    <div className="flex items-center gap-2"><EventIconBadge name="content" /><h3 className="text-sm font-semibold text-ink">Temel bilgiler</h3></div>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <label className="grid gap-1.5 text-sm font-medium text-ink-soft sm:col-span-2">Etkinlik adı<input id="event-title" type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} disabled={isSaving} className="min-h-[44px] rounded-md border border-canvas-border bg-canvas px-3 py-2 text-sm font-normal text-ink" /></label>
                      <label className="grid gap-1.5 text-sm font-medium text-ink-soft sm:col-span-2">Açıklama<textarea id="event-description" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} disabled={isSaving} rows={4} className="rounded-md border border-canvas-border bg-canvas px-3 py-2 text-sm font-normal text-ink" /></label>
                      <label className="grid gap-1.5 text-sm font-medium text-ink-soft">Etkinlik durumu<select id="event-status" value={editEventStatus} onChange={(e) => setEditEventStatus(e.target.value)} disabled={isSaving || availableEventStatuses.length === 0} className="min-h-[44px] rounded-md border border-canvas-border bg-canvas px-3 py-2 text-sm font-normal text-ink disabled:opacity-60">{availableEventStatuses.map((status) => <option key={status.slug} value={status.slug}>{status.label}</option>)}</select></label>
                      <label className="grid gap-1.5 text-sm font-medium text-ink-soft">Rapor durumu<select id="event-report-status" value={editReportStatus} onChange={(e) => setEditReportStatus(e.target.value)} disabled={isSaving || availableEventReportStatuses.length === 0} className="min-h-[44px] rounded-md border border-canvas-border bg-canvas px-3 py-2 text-sm font-normal text-ink disabled:opacity-60">{availableEventReportStatuses.map((status) => <option key={status.slug} value={status.slug}>{status.label}</option>)}</select></label>
                    </div>
                  </section>

                  <section className="rounded-xl border border-canvas-border p-4 sm:p-5">
                    <div className="flex items-center gap-2"><EventIconBadge name="calendar" /><h3 className="text-sm font-semibold text-ink">Tarih planlaması</h3></div>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <label className="grid gap-1.5 text-sm font-medium text-ink-soft">Planlama tarihi<input id="event-planning-date" type="date" value={editPlanningDate} onChange={(e) => setEditPlanningDate(e.target.value)} disabled={isSaving} className="min-h-[44px] rounded-md border border-canvas-border bg-canvas px-3 py-2 text-sm font-normal text-ink" /></label>
                      <label className="grid gap-1.5 text-sm font-medium text-ink-soft">Tahmini etkinlik tarihi<input id="event-estimated-date" type="date" value={editEstimatedDate} onChange={(e) => setEditEstimatedDate(e.target.value)} disabled={isSaving} className="min-h-[44px] rounded-md border border-canvas-border bg-canvas px-3 py-2 text-sm font-normal text-ink" /></label>
                      <label className="grid gap-1.5 text-sm font-medium text-ink-soft">Hazırlık başlangıç tarihi<input id="event-preparation-start-date" type="date" value={editPreparationStartDate} onChange={(e) => setEditPreparationStartDate(e.target.value)} disabled={isSaving} className="min-h-[44px] rounded-md border border-canvas-border bg-canvas px-3 py-2 text-sm font-normal text-ink" /><span className="text-xs font-normal">İsteğe bağlı; gerektiğinde elle değiştirebilirsiniz.</span></label>
                      <label className="grid gap-1.5 text-sm font-medium text-ink-soft">Kesinleşmiş tarih<input id="event-confirmed-date" type="date" value={editConfirmedDate} onChange={(e) => setEditConfirmedDate(e.target.value)} disabled={isSaving} className="min-h-[44px] rounded-md border border-canvas-border bg-canvas px-3 py-2 text-sm font-normal text-ink" /></label>
                    </div>
                  </section>
                </div>

                <aside className="rounded-xl border border-canvas-border p-4 sm:p-5">
                  <div className="flex items-center gap-2"><EventIconBadge name="person" /><h3 className="text-sm font-semibold text-ink">Süreç bilgileri</h3></div>
                  <p className="mt-2 text-xs text-ink-soft">Etkinliğin sorumlusu ve önemli durumları.</p>
                  <div className="mt-5">
                    {isSuperAdmin ? <label className="grid gap-1.5 text-sm font-medium text-ink-soft">Sorumlu<select id="event-owner" value={editOwnerId} onChange={(e) => setEditOwnerId(e.target.value)} disabled={isSaving || periodMembersLoadState === 'loading'} className="min-h-[44px] rounded-md border border-canvas-border bg-canvas px-3 py-2 text-sm font-normal text-ink disabled:opacity-60"><option value="" disabled>Sorumlu seçin</option>{periodMembers.map((member) => <option key={member.profileId} value={member.profileId}>{member.coordinatorRoleName ?? 'Ekip üyesi'} — {member.displayName}</option>)}</select>{periodMembersLoadState === 'error' ? <span className="text-xs text-red-600">Üye listesi yüklenemedi.</span> : null}</label> : <div><p className="text-sm font-medium text-ink-soft">Sorumlu</p><p className="mt-1 flex min-h-[44px] items-center rounded-md border border-canvas-border bg-canvas px-3 text-sm text-ink">{displayedOwner}</p></div>}
                  </div>
                  <div className="mt-5 space-y-3 border-t border-dashed border-canvas-border pt-5">
                    <div className="rounded-xl border border-brand/15 bg-brand-soft/40 p-4"><p className="text-xs text-ink-soft">Etkinlik durumu</p><p className="mt-1 font-semibold text-ink">{availableEventStatuses.find((status) => status.slug === editEventStatus)?.label ?? editEventStatus}</p></div>
                    <div className="rounded-xl border border-brand/15 bg-brand-soft/40 p-4"><p className="text-xs text-ink-soft">Rapor durumu</p><p className="mt-1 font-semibold text-ink">{availableEventReportStatuses.find((status) => status.slug === editReportStatus)?.label ?? editReportStatus}</p></div>
                    <p className="rounded-xl border border-canvas-border bg-canvas p-4 text-xs leading-5 text-ink-soft">Hazırlık başlangıç tarihi gerektiğinde elle düzenlenebilir.</p>
                  </div>
                </aside>
              </div>

              {saveError ? <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</p> : null}
            </div>

            <div className="flex flex-col gap-3 border-t border-canvas-border bg-canvas/50 px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button type="button" onClick={cancelEditing} disabled={isSaving} className="min-h-[44px] rounded-md border border-brand px-6 text-sm font-medium text-brand-dark disabled:opacity-60">İptal</button>
              <button type="button" onClick={handleSave} disabled={isSaving} className="min-h-[44px] rounded-md bg-brand-dark px-7 text-sm font-medium text-white disabled:opacity-60">{isSaving ? 'Kaydediliyor…' : 'Kaydet'}</button>
            </div>
          </div>
        ) : null}

        {activeDetailTab === 'overview' ? (
          <section className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="Etkinlik hızlı özeti">
            <div className="rounded-xl border border-canvas-border bg-canvas-surface p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Sonraki işlem</p><p className={`mt-2 text-sm font-semibold leading-5 ${event.nextAction ? 'text-ink' : 'italic text-ink-soft'}`}>{event.nextAction || 'Sonraki işlem belirlenmedi.'}</p></div>
                {canEdit ? <button type="button" onClick={() => openProcessFieldEditing('nextAction')} className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-brand-dark hover:bg-brand-soft">Düzenle</button> : null}
              </div>
            </div>
            <div className="rounded-xl border border-canvas-border bg-canvas-surface p-4 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Yaklaşan tarih</p>
              {upcomingEventDate ? <><p className="mt-2 text-sm font-semibold text-ink">{formatDate(upcomingEventDate.value)}</p><p className="mt-1 text-xs text-ink-soft">{upcomingEventDate.label}</p></> : <p className="mt-2 text-sm italic text-ink-soft">Yaklaşan tarih yok.</p>}
            </div>
            <button type="button" onClick={() => setActiveDetailTab('operations')} className="rounded-xl border border-canvas-border bg-canvas-surface p-4 text-left shadow-card transition hover:border-brand/40 hover:bg-brand-soft/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Açık görev</p>
              <p className="mt-2 text-sm font-semibold text-ink">{openTaskCount} açık görev</p>
              <p className="mt-1 line-clamp-1 text-xs text-ink-soft">{nextOpenTask ? nextOpenTask.title : 'Açık görev bulunmuyor.'}</p>
            </button>
          </section>
        ) : null}

        <div id="event-notes" className={activeDetailTab === 'overview' ? 'mt-4 grid scroll-mt-28 gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.85fr)]' : 'hidden'}>
          <div className="space-y-4">
            <section className="rounded-xl border border-canvas-border bg-canvas-surface p-4 shadow-card sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3"><EventIconBadge name="note" /><h2 className="text-base font-semibold text-ink">Etkinlik özeti</h2></div>
                {canEdit && !isEditingGeneralNote ? <button type="button" onClick={() => setIsEditingGeneralNote(true)} className="flex min-h-[40px] items-center gap-2 rounded-md border border-brand/40 px-3 text-xs font-semibold text-brand-dark"><EventIcon name="edit" className="h-4 w-4" />Özeti düzenle</button> : null}
              </div>
              <div className="mt-4">
                {canEdit && isEditingGeneralNote ? (
                  <div className="overflow-hidden rounded-xl border border-canvas-border bg-canvas">
                    <div className="p-4">
                      <label htmlFor="event-general-note" className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Güncel özet</label>
                      <textarea
                        id="event-general-note"
                        value={generalNoteInputValue}
                        onChange={(event) => setGeneralNoteInputValue(event.target.value)}
                        disabled={isSavingGeneralNote}
                        rows={6}
                        className="mt-2 min-h-36 w-full resize-y rounded-xl border border-canvas-border bg-canvas-surface px-3 py-3 text-sm leading-6 text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10 disabled:opacity-60"
                        placeholder="Etkinliğin güncel durumunu, önemli gelişmeleri ve kısa özetini yazınız..."
                      />
                    </div>
                    <div className="flex flex-col-reverse gap-2 border-t border-canvas-border bg-canvas-surface px-4 py-3 sm:flex-row sm:justify-end">
                      <button type="button" onClick={() => setIsEditingGeneralNote(false)} disabled={isSavingGeneralNote} className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-brand px-5 text-sm font-semibold text-brand-dark transition hover:bg-brand-soft disabled:opacity-60 sm:w-auto">İptal</button>
                      <button type="button" onClick={() => void handleSaveGeneralNote()} disabled={isSavingGeneralNote} className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-brand-dark px-6 text-sm font-semibold text-white transition hover:bg-brand disabled:opacity-60 sm:w-auto">
                        {isSavingGeneralNote ? 'Kaydediliyor…' : 'Özeti kaydet'}
                      </button>
                    </div>
                  </div>
                ) : (
                  event.generalNote ? (
                    <div className="rounded-xl border border-brand/10 bg-brand-soft/20 px-4 py-3.5"><p className="whitespace-pre-wrap text-sm leading-6 text-ink">{event.generalNote}</p></div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-canvas-border bg-canvas px-4 py-8 text-center"><p className="text-sm font-semibold text-ink">Henüz etkinlik özeti yok</p><p className="mt-1 text-xs text-ink-soft">Güncel durumu ekibe aktarmak için bir özet ekleyebilirsiniz.</p></div>
                  )
                )}
                {generalNoteError ? <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{generalNoteError}</p> : null}
                {generalNoteSuccess && !isEditingGeneralNote ? <p className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">{generalNoteSuccess}</p> : null}
              </div>
            </section>


            <section className="rounded-xl border border-canvas-border bg-canvas-surface p-4 shadow-card sm:p-6">
              <div className="flex items-center gap-3">
                <EventIconBadge name="operations" />
                <div>
                  <h2 className="text-base font-semibold text-ink">Süreçler</h2>
                  <p className="mt-1 text-xs text-ink-soft">Tasarım ve Duyuru / Yayın akışlarını ayrı ayrı takip edin.</p>
                </div>
              </div>
              <div className="mt-4 divide-y divide-canvas-border rounded-lg border border-canvas-border bg-canvas">
                <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-ink">Tasarım</p>
                    <p className="mt-0.5 text-xs text-ink-soft">Brief, tasarım ve revize aşamaları</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <span className="inline-flex w-fit rounded-full bg-canvas-surface px-3 py-1 text-xs font-semibold text-ink">
                      {availableEventDesignAnnouncementStatuses.find((status) => status.slug === event.designAnnouncementStatus)?.label ?? event.designAnnouncementStatus}
                    </span>
                    {canChangeDesignAnnouncementStatus ? (
                      <button type="button" onClick={openDesignStatusEditing} className="inline-flex min-h-10 items-center rounded-md px-2 text-xs font-semibold text-brand-dark hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                        Düzenle
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-ink">Duyuru / Yayın</p>
                    <p className="mt-0.5 text-xs text-ink-soft">İçerik hazırlığı, yayın planı ve paylaşım</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <span className="inline-flex w-fit rounded-full bg-canvas-surface px-3 py-1 text-xs font-semibold text-ink">
                      {availableEventAnnouncementStatuses.find((status) => status.slug === event.announcementStatus)?.label ?? event.announcementStatus}
                    </span>
                    {canChangeAnnouncementStatus ? (
                      <button type="button" onClick={openAnnouncementStatusEditing} className="inline-flex min-h-10 items-center rounded-md px-2 text-xs font-semibold text-brand-dark hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                        Düzenle
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
              {designAnnouncementStatusError ? <p className="mt-3 text-xs text-red-600">{designAnnouncementStatusError}</p> : null}
              {designAnnouncementStatusSuccess ? <p className="mt-3 text-xs text-green-600">{designAnnouncementStatusSuccess}</p> : null}
              {announcementStatusError ? <p className="mt-3 text-xs text-red-600">{announcementStatusError}</p> : null}
              {announcementStatusSuccess ? <p className="mt-3 text-xs text-green-600">{announcementStatusSuccess}</p> : null}
              <p className="mt-3 text-xs text-ink-soft">SKS ayrıntıları Operasyon sekmesinde; burada yalnız Tasarım ve Duyuru / Yayın takip edilir.</p>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="rounded-xl border border-canvas-border bg-canvas-surface p-4 shadow-card sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3"><EventIconBadge name="calendar" /><h2 className="text-base font-semibold text-ink">Tarihler</h2></div>
                {canEdit ? <button type="button" onClick={openDateEditing} className="min-h-[40px] shrink-0 rounded-md border border-brand/40 px-3 text-xs font-semibold text-brand-dark">Tarihleri düzenle</button> : null}
              </div>
              <div className="relative mt-5 space-y-5 pl-5 before:absolute before:bottom-3 before:left-[5px] before:top-3 before:border-l before:border-dashed before:border-brand/30">
                {([
                  ['Planlama tarihi', event.planningDate, 'bg-brand-dark'],
                  ['Hazırlık başlangıç tarihi', event.preparationStartDate, 'bg-sky-500'],
                  ['Tahmini etkinlik tarihi', event.estimatedDate, 'bg-accent'],
                  ['Kesinleşmiş tarih', event.confirmedDate, 'bg-brand-dark'],
                ] as const).map(([label, value, dot]) => <div key={label} className="relative flex items-start justify-between gap-3"><span className={`absolute -left-5 top-1.5 h-2.5 w-2.5 rounded-full ${dot}`} /><div><p className="text-xs font-semibold text-ink">{label}</p></div><p className="text-xs font-medium text-ink">{formatDate(value)}</p></div>)}
              </div>
            </section>

            <section className="rounded-xl border border-canvas-border bg-canvas-surface p-4 shadow-card sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3"><EventIconBadge name="pin" /><div><h2 className="text-base font-semibold text-ink">Mekân</h2><p className="mt-1 text-xs text-ink-soft">Etkinliğin yapılacağı yer.</p></div></div>
                {canEdit ? <button type="button" onClick={() => openProcessFieldEditing('venue')} className="min-h-[40px] shrink-0 rounded-md border border-brand/40 px-3 text-xs font-semibold text-brand-dark">Mekânı düzenle</button> : null}
              </div>
              <p className={`mt-4 text-sm ${event.venue ? 'text-ink' : 'italic text-ink-soft'}`}>{displayedVenue}</p>
            </section>
          </aside>
        </div>

        {/* Kararlar Bölümü */}
        <div id="event-decisions" className={activeDetailTab === 'content' ? 'mt-4 scroll-mt-28 rounded-xl border border-canvas-border bg-canvas-surface p-4 shadow-card sm:p-5' : 'hidden'}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3"><EventIconBadge name="decision" /><h2 className="text-base font-semibold text-ink">Kararlar</h2><span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold text-ink-soft">{decisions.filter((item) => !item.deletedAt).length}</span></div>
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
            {canEdit && (
              <button
                type="button"
                onClick={isDecisionFormOpen ? closeDecisionForm : openCreateDecisionForm}
                className="min-h-[44px] shrink-0 rounded-md bg-brand-dark px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                {isDecisionFormOpen ? 'Formu kapat' : 'Karar ekle'}
              </button>
            )}
          </div>

          {decisionSuccessMessage && !isDecisionFormOpen && (
            <p className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {decisionSuccessMessage}
            </p>
          )}

          <div className={`mt-4 grid gap-4 ${isDecisionFormOpen ? 'lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)]' : ''}`}>
            <div className={`rounded-xl border border-canvas-border bg-canvas ${isDecisionFormOpen ? 'min-h-[390px] p-4' : 'p-0 border-0 bg-transparent'}`}>
              {decisionsLoadState === 'loading' && (
                <p className="p-4 text-sm text-ink-soft">Kararlar yükleniyor…</p>
              )}
              {decisionsLoadState === 'error' && (
                <p className="m-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  Kararlar yüklenirken bir hata oluştu.
                </p>
              )}
              {decisionsLoadState === 'ready' && decisions.length === 0 && (
                <div className="flex min-h-[340px] flex-col items-center justify-center px-5 py-10 text-center">
                  <div className="flex items-center gap-5 text-canvas-border" aria-hidden="true">
                    <span className="h-px w-12 bg-canvas-border" />
                    <span className="flex h-16 w-16 items-center justify-center rounded-full border border-brand/20 bg-brand-soft text-brand-dark">
                      <EventIcon name="decision" className="h-7 w-7" />
                    </span>
                    <span className="h-px w-12 bg-canvas-border" />
                  </div>
                  <h3 className="mt-5 text-base font-semibold text-ink">Henüz karar bulunmuyor</h3>
                  <p className="mt-2 text-sm text-ink-soft">Bu etkinlik için henüz karar eklenmemiş.</p>
                </div>
              )}
              {decisionsLoadState === 'ready' && decisions.length > 0 && (
                <div className="flex flex-col gap-3">
                  {decisions.map((decision) => (
                    <div
                      key={decision.id}
                      className={`rounded-lg border px-4 py-3 ${
                        decision.deletedAt ? 'border-red-200 bg-red-50/40' : 'border-canvas-border bg-canvas-surface'
                      }`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="break-words text-sm font-semibold text-ink">{decision.title}</h4>
                            {decision.deletedAt ? <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Pasif karar</span> : null}
                          </div>
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-ink-soft">{decision.decisionText}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
                            <span>{formatDate(decision.decidedAt)}</span><span>{decision.creatorName}</span>
                          </div>
                        </div>
                        {canEdit && !decision.deletedAt ? (
                          <div className="flex shrink-0 items-center gap-3">
                            <button type="button" onClick={() => openEditDecisionForm(decision)} className="min-h-[40px] rounded-md px-2 text-xs font-semibold text-brand-dark hover:bg-brand-soft">Düzenle</button>
                            <button type="button" onClick={() => void handleDeactivateDecision(decision.id)} disabled={deactivatingDecisionId === decision.id} className="min-h-[40px] rounded-md px-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">{deactivatingDecisionId === decision.id ? 'İşleniyor…' : 'Pasifleştir'}</button>
                          </div>
                        ) : null}
                        {canEdit && decision.deletedAt ? (
                          <button type="button" onClick={() => void handleReactivateDecision(decision.id)} disabled={deactivatingDecisionId === decision.id} className="min-h-[40px] shrink-0 rounded-md border border-green-200 bg-green-50 px-3 text-xs font-semibold text-green-700 disabled:opacity-50">{deactivatingDecisionId === decision.id ? 'İşleniyor…' : 'Yeniden aktifleştir'}</button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {isDecisionFormOpen ? (
              <div className="overflow-hidden rounded-xl border border-canvas-border bg-canvas shadow-card">
                <div className="flex items-center justify-between gap-3 border-b border-canvas-border bg-canvas-surface px-4 py-3 sm:px-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <EventIconBadge name="decision" />
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-ink sm:text-base">{decisionFormMode === 'create' ? 'Yeni karar ekle' : 'Kararı düzenle'}</h3>
                      <p className="mt-0.5 text-xs text-ink-soft">Alınan kararı ve karar tarihini kaydedin.</p>
                    </div>
                  </div>
                  <button type="button" onClick={closeDecisionForm} disabled={isSavingDecision} aria-label="Karar formunu kapat" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-canvas-border text-lg text-ink-soft transition hover:bg-canvas hover:text-ink disabled:opacity-60">×</button>
                </div>

                <div className="p-4 sm:p-5">
                  <section className="rounded-xl border border-canvas-border bg-canvas-surface p-4">
                    <div className="flex items-center gap-2"><EventIconBadge name="content" /><div><h4 className="text-sm font-semibold text-ink">Karar bilgileri</h4><p className="mt-0.5 text-xs text-ink-soft">Başlık ve kararın ayrıntılı açıklaması.</p></div></div>
                    <div className="mt-4 flex flex-col gap-4">
                      <label htmlFor="decision-title" className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                        Karar başlığı
                        <input id="decision-title" type="text" value={decisionTitle} onChange={(e) => setDecisionTitle(e.target.value)} disabled={isSavingDecision} placeholder="Karar başlığını giriniz" className="min-h-11 rounded-lg border border-canvas-border bg-canvas px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10 disabled:opacity-60" />
                      </label>
                      <label htmlFor="decision-text" className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                        Karar açıklaması
                        <textarea id="decision-text" value={decisionText} onChange={(e) => setDecisionText(e.target.value)} disabled={isSavingDecision} rows={6} placeholder="Kararın içeriğini ve gerekçesini yazınız" className="min-h-36 resize-y rounded-lg border border-canvas-border bg-canvas px-3 py-3 text-sm font-normal normal-case leading-6 tracking-normal text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10 disabled:opacity-60" />
                      </label>
                    </div>
                  </section>

                  <section className="mt-4 rounded-xl border border-canvas-border bg-canvas-surface p-4">
                    <div className="flex items-center gap-2"><EventIconBadge name="calendar" /><div><h4 className="text-sm font-semibold text-ink">Karar tarihi</h4><p className="mt-0.5 text-xs text-ink-soft">Kararın ekip tarafından alındığı gün.</p></div></div>
                    <label htmlFor="decision-date" className="mt-4 flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                      Tarih
                      <input id="decision-date" type="date" value={decisionDate} onChange={(e) => setDecisionDate(e.target.value)} disabled={isSavingDecision} className="min-h-11 w-full rounded-lg border border-canvas-border bg-canvas px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10 disabled:opacity-60 sm:max-w-sm" />
                    </label>
                  </section>

                  {decisionFormError ? <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{decisionFormError}</p> : null}
                </div>

                <div className="flex flex-col-reverse gap-2 border-t border-canvas-border bg-canvas-surface px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
                  <button type="button" onClick={closeDecisionForm} disabled={isSavingDecision} className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-brand px-5 text-sm font-semibold text-brand-dark transition hover:bg-brand-soft disabled:opacity-60 sm:w-auto">İptal</button>
                  <button type="button" onClick={() => void handleSaveDecision()} disabled={isSavingDecision} className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-brand-dark px-6 text-sm font-semibold text-white transition hover:bg-brand disabled:opacity-60 sm:w-auto">{isSavingDecision ? 'Kaydediliyor…' : decisionFormMode === 'create' ? 'Kararı kaydet' : 'Değişiklikleri kaydet'}</button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Raporlar Bölümü */}
        <div id="event-reports" className={activeDetailTab === 'content' ? 'mt-3 scroll-mt-28 rounded-xl border border-canvas-border bg-canvas-surface p-4 shadow-card sm:p-5' : 'hidden'}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3"><EventIconBadge name="report" tone="sky" /><h2 className="text-base font-semibold text-ink">Raporlar</h2><span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold text-ink-soft">{reports.filter((item) => !item.deletedAt).length}</span></div>
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
                className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-lg bg-brand-dark px-4 text-sm font-semibold text-white transition hover:bg-brand sm:w-auto"
              >
                + Rapor ekle
              </button>
            )}
          </div>

          {reportSuccessMessage && !isReportFormOpen && (
            <p className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {reportSuccessMessage}
            </p>
          )}

          {isReportFormOpen && (
            <div className="mt-4 overflow-hidden rounded-xl border border-canvas-border bg-canvas shadow-card">
              <div className="flex items-center justify-between gap-3 border-b border-canvas-border bg-canvas-surface px-4 py-3 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <EventIconBadge name="report" tone="sky" />
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-ink sm:text-base">{reportFormMode === 'create' ? 'Yeni rapor' : 'Raporu düzenle'}</h3>
                    <p className="mt-0.5 text-xs text-ink-soft">Etkinlik sonucunu ve rapor tarihini kaydedin.</p>
                  </div>
                </div>
                <button type="button" onClick={closeReportForm} disabled={isSavingReport} aria-label="Rapor formunu kapat" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-canvas-border text-lg text-ink-soft transition hover:bg-canvas hover:text-ink disabled:opacity-60">×</button>
              </div>

              <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
                <section className="rounded-xl border border-canvas-border bg-canvas-surface p-4">
                  <div className="flex items-center gap-2"><EventIconBadge name="content" /><div><h4 className="text-sm font-semibold text-ink">Rapor içeriği</h4><p className="mt-0.5 text-xs text-ink-soft">Başlık ve etkinlik değerlendirmesi.</p></div></div>
                  <div className="mt-4 flex flex-col gap-4">
                    <label htmlFor="report-title" className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                      Rapor başlığı
                      <input id="report-title" type="text" value={reportTitle} onChange={(e) => setReportTitle(e.target.value)} disabled={isSavingReport} placeholder="Rapor başlığını giriniz" className="min-h-11 rounded-lg border border-canvas-border bg-canvas px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10 disabled:opacity-60" />
                    </label>
                    <label htmlFor="report-text" className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                      Rapor metni
                      <textarea id="report-text" value={reportText} onChange={(e) => setReportText(e.target.value)} disabled={isSavingReport} rows={7} placeholder="Etkinliğin sonucunu ve önemli notları yazınız" className="min-h-40 resize-y rounded-lg border border-canvas-border bg-canvas px-3 py-3 text-sm font-normal normal-case leading-6 tracking-normal text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10 disabled:opacity-60" />
                    </label>
                  </div>
                </section>

                <section className="rounded-xl border border-canvas-border bg-canvas-surface p-4">
                  <div className="flex items-center gap-2"><EventIconBadge name="calendar" /><div><h4 className="text-sm font-semibold text-ink">Rapor tarihi</h4><p className="mt-0.5 text-xs text-ink-soft">Raporun tamamlandığı tarih.</p></div></div>
                  <label htmlFor="report-date" className="mt-4 flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                    Tarih
                    <input id="report-date" type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} disabled={isSavingReport} className="min-h-11 w-full rounded-lg border border-canvas-border bg-canvas px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10 disabled:opacity-60" />
                  </label>
                  <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50/60 px-4 py-3">
                    <p className="text-xs leading-5 text-ink-soft">Rapor geçmişteki etkinlik değerlendirmelerinin kaybolmaması için kayıt altında tutulur.</p>
                  </div>
                </section>

                {reportFormError && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 lg:col-span-2">{reportFormError}</p>}
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-canvas-border bg-canvas-surface px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
                <button type="button" onClick={closeReportForm} disabled={isSavingReport} className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-brand px-5 text-sm font-semibold text-brand-dark transition hover:bg-brand-soft disabled:opacity-60 sm:w-auto">İptal</button>
                <button type="button" onClick={() => void handleSaveReport()} disabled={isSavingReport} className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-brand-dark px-6 text-sm font-semibold text-white transition hover:bg-brand disabled:opacity-60 sm:w-auto">{isSavingReport ? 'Kaydediliyor…' : reportFormMode === 'create' ? 'Raporu kaydet' : 'Değişiklikleri kaydet'}</button>
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
            <div className="mt-4 rounded-xl border border-dashed border-canvas-border bg-canvas px-4 py-9 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 text-sky-700"><EventIcon name="report" className="h-5 w-5" /></span>
              <p className="mt-3 text-sm font-semibold text-ink">Henüz rapor eklenmedi</p>
              <p className="mt-1 text-xs text-ink-soft">Etkinlik değerlendirmeleri burada listelenecek.</p>
            </div>
          )}
          {reportsLoadState === 'ready' && reports.length > 0 && (
            <div className="mt-4 flex flex-col gap-4">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className={`rounded-xl border p-4 ${
                    report.deletedAt ? 'border-red-200 bg-red-50/40' : 'border-canvas-border bg-canvas'
                  }`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700"><EventIcon name="report" className="h-4.5 w-4.5" /></span>
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
                    </div>
                    {canEdit && !report.deletedAt && (
                      <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex sm:items-center">
                        <button
                          type="button"
                          onClick={() => openEditReportForm(report)}
                          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-brand/40 px-3 text-xs font-semibold text-brand-dark hover:bg-brand-soft"
                        >
                          Düzenle
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeactivateReport(report.id)}
                          disabled={deactivatingReportId === report.id}
                          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
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
                        className="inline-flex min-h-10 w-full shrink-0 items-center justify-center rounded-lg border border-green-200 bg-green-50 px-3 text-xs font-semibold text-green-700 disabled:opacity-50 sm:w-auto"
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
        <div id="event-links" className={activeDetailTab === 'content' ? 'mt-3 scroll-mt-28 rounded-xl border border-canvas-border bg-canvas-surface p-4 shadow-card sm:p-5' : 'hidden'}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3"><EventIconBadge name="link" /><h2 className="text-base font-semibold text-ink">Bağlantılar</h2><span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold text-ink-soft">{links.filter((item) => !item.deletedAt).length}</span></div>
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
                className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-lg bg-brand-dark px-4 text-sm font-semibold text-white transition hover:bg-brand sm:w-auto"
              >
                + Bağlantı ekle
              </button>
            )}
          </div>

          {linkSuccessMessage && !isLinkFormOpen && (
            <p className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {linkSuccessMessage}
            </p>
          )}

          {isLinkFormOpen && (
            <div className="mt-4 overflow-hidden rounded-xl border border-canvas-border bg-canvas shadow-card">
              <div className="flex items-center justify-between gap-3 border-b border-canvas-border bg-canvas-surface px-4 py-3 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <EventIconBadge name="link" />
                  <div className="min-w-0"><h3 className="text-sm font-semibold text-ink sm:text-base">{linkFormMode === 'create' ? 'Yeni bağlantı' : 'Bağlantıyı düzenle'}</h3><p className="mt-0.5 text-xs text-ink-soft">Etkinlikte kullanılan dış kaynağı kaydedin.</p></div>
                </div>
                <button type="button" onClick={closeLinkForm} disabled={isSavingLink} aria-label="Bağlantı formunu kapat" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-canvas-border text-lg text-ink-soft transition hover:bg-canvas hover:text-ink disabled:opacity-60">×</button>
              </div>

              <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
                <section className="rounded-xl border border-canvas-border bg-canvas-surface p-4">
                  <div className="flex items-center gap-2"><EventIconBadge name="link" /><div><h4 className="text-sm font-semibold text-ink">Bağlantı bilgileri</h4><p className="mt-0.5 text-xs text-ink-soft">Kaynağın adı ve internet adresi.</p></div></div>
                  <div className="mt-4 flex flex-col gap-4">
                    <label htmlFor="link-title" className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                      Bağlantı başlığı
                      <input id="link-title" type="text" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} disabled={isSavingLink} placeholder="Örn. Başvuru formu" className="min-h-11 rounded-lg border border-canvas-border bg-canvas px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10 disabled:opacity-60" />
                    </label>
                    <label htmlFor="link-url" className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                      İnternet adresi
                      <input id="link-url" type="url" inputMode="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} disabled={isSavingLink} placeholder="https://ornek.com" className="min-h-11 rounded-lg border border-canvas-border bg-canvas px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10 disabled:opacity-60" />
                    </label>
                  </div>
                </section>

                <section className="rounded-xl border border-canvas-border bg-canvas-surface p-4">
                  <div className="flex items-center gap-2"><EventIconBadge name="note" /><div><h4 className="text-sm font-semibold text-ink">Açıklama</h4><p className="mt-0.5 text-xs text-ink-soft">Bağlantının ne amaçla kullanıldığını belirtin.</p></div></div>
                  <label htmlFor="link-description" className="mt-4 flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                    Açıklama <span className="normal-case tracking-normal text-ink-soft/80">(isteğe bağlı)</span>
                    <textarea id="link-description" value={linkDescription} onChange={(e) => setLinkDescription(e.target.value)} disabled={isSavingLink} rows={5} placeholder="Kısa bir açıklama yazınız" className="min-h-32 resize-y rounded-lg border border-canvas-border bg-canvas px-3 py-3 text-sm font-normal normal-case leading-6 tracking-normal text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10 disabled:opacity-60" />
                  </label>
                </section>

                {linkFormError && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 lg:col-span-2">{linkFormError}</p>}
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-canvas-border bg-canvas-surface px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
                <button type="button" onClick={closeLinkForm} disabled={isSavingLink} className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-brand px-5 text-sm font-semibold text-brand-dark transition hover:bg-brand-soft disabled:opacity-60 sm:w-auto">İptal</button>
                <button type="button" onClick={() => void handleSaveLink()} disabled={isSavingLink} className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-brand-dark px-6 text-sm font-semibold text-white transition hover:bg-brand disabled:opacity-60 sm:w-auto">{isSavingLink ? 'Kaydediliyor…' : linkFormMode === 'create' ? 'Bağlantıyı kaydet' : 'Değişiklikleri kaydet'}</button>
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
            <div className="mt-4 rounded-xl border border-dashed border-canvas-border bg-canvas px-4 py-9 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand-dark"><EventIcon name="link" className="h-5 w-5" /></span>
              <p className="mt-3 text-sm font-semibold text-ink">Henüz bağlantı eklenmedi</p>
              <p className="mt-1 text-xs text-ink-soft">Formlar ve dış kaynaklar burada listelenecek.</p>
            </div>
          )}
          {linksLoadState === 'ready' && links.length > 0 && (
            <div className="mt-4 flex flex-col gap-4">
              {links.map((link) => (
                <div
                  key={link.id}
                  className={`rounded-xl border p-4 ${
                    link.deletedAt ? 'border-red-200 bg-red-50/40' : 'border-canvas-border bg-canvas'
                  }`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3 overflow-hidden">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-dark"><EventIcon name="link" className="h-4.5 w-4.5" /></span>
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
                    </div>
                    {canEdit && !link.deletedAt && (
                      <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex sm:items-center">
                        <button
                          type="button"
                          onClick={() => openEditLinkForm(link)}
                          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-brand/40 px-3 text-xs font-semibold text-brand-dark hover:bg-brand-soft"
                        >
                          Düzenle
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeactivateLink(link.id)}
                          disabled={deactivatingLinkId === link.id}
                          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
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
                        className="inline-flex min-h-10 w-full shrink-0 items-center justify-center rounded-lg border border-green-200 bg-green-50 px-3 text-xs font-semibold text-green-700 disabled:opacity-50 sm:w-auto"
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
        <div id="event-files" className={activeDetailTab === 'content' ? 'mt-3 scroll-mt-28 rounded-xl border border-canvas-border bg-canvas-surface p-4 shadow-card sm:p-5' : 'hidden'}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3"><EventIconBadge name="file" tone="violet" /><h2 className="text-base font-semibold text-ink">Dosyalar</h2><span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold text-ink-soft">{files.filter((item) => !item.deletedAt).length}</span></div>
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
                className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-lg bg-brand-dark px-4 text-sm font-semibold text-white transition hover:bg-brand sm:w-auto"
              >
                + Dosya ekle
              </button>
            )}
          </div>

          {fileSuccessMessage && !isFileFormOpen && (
            <p className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {fileSuccessMessage}
            </p>
          )}

          {isFileFormOpen && (
            <div className="mt-4 overflow-hidden rounded-xl border border-canvas-border bg-canvas shadow-card">
              <div className="flex items-center justify-between gap-3 border-b border-canvas-border bg-canvas-surface px-4 py-3 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <EventIconBadge name="file" tone="violet" />
                  <div className="min-w-0"><h3 className="text-sm font-semibold text-ink sm:text-base">Yeni dosya ekle</h3><p className="mt-0.5 text-xs text-ink-soft">Etkinlikle ilgili belge ve dosyaları yükleyin.</p></div>
                </div>
                <button type="button" onClick={closeFileUploadForm} disabled={isUploadingFile} aria-label="Dosya formunu kapat" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-canvas-border text-lg text-ink-soft transition hover:bg-canvas hover:text-ink disabled:opacity-60">×</button>
              </div>

              <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
                <section className="rounded-xl border border-canvas-border bg-canvas-surface p-4">
                  <div className="flex items-center gap-2"><EventIconBadge name="file" tone="violet" /><div><h4 className="text-sm font-semibold text-ink">Dosya seçimi</h4><p className="mt-0.5 text-xs text-ink-soft">Yüklenecek dosyanın boyutu en fazla 5 MB olabilir.</p></div></div>
                  <label htmlFor="file-upload-input" className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-violet-200 bg-violet-50/40 px-4 py-8 text-center transition hover:bg-violet-50">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 text-violet-700"><EventIcon name="file" className="h-5 w-5" /></span>
                    <span className="mt-3 text-sm font-semibold text-ink">Dosya seçmek için dokunun</span>
                    <span className="mt-1 text-xs text-ink-soft">Bilgisayarınızdan veya cihazınızdan bir dosya seçin</span>
                    <input
                      id="file-upload-input"
                      type="file"
                      onChange={(e) => {
                        const chosen = e.target.files && e.target.files[0] ? e.target.files[0] : null
                        setSelectedUploadFile(chosen)
                        setFileFormError(null)
                      }}
                      disabled={isUploadingFile}
                      className="sr-only"
                    />
                  </label>
                </section>

                <section className="rounded-xl border border-canvas-border bg-canvas-surface p-4">
                  <div className="flex items-center gap-2"><EventIconBadge name="content" /><div><h4 className="text-sm font-semibold text-ink">Seçilen dosya</h4><p className="mt-0.5 text-xs text-ink-soft">Yüklemeden önce dosyayı kontrol edin.</p></div></div>
                  {selectedUploadFile ? (
                    <div className="mt-4 rounded-xl border border-brand/15 bg-brand-soft/30 p-4">
                      <div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-canvas text-brand-dark"><EventIcon name="file" className="h-5 w-5" /></span><div className="min-w-0"><p className="break-words text-sm font-semibold text-ink">{selectedUploadFile.name}</p><p className="mt-1 text-xs text-ink-soft">{formatFileSize(selectedUploadFile.size)}</p></div></div>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl border border-dashed border-canvas-border bg-canvas px-4 py-7 text-center"><p className="text-sm font-medium text-ink">Henüz dosya seçilmedi</p><p className="mt-1 text-xs text-ink-soft">Soldaki alandan bir dosya seçin.</p></div>
                  )}
                  <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50/50 px-4 py-3"><p className="text-xs leading-5 text-ink-soft">Dosya etkinliğin içerik bölümünde saklanır ve yetkili ekip üyeleri tarafından açılabilir.</p></div>
                </section>

                {fileFormError && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 lg:col-span-2">{fileFormError}</p>}
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-canvas-border bg-canvas-surface px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
                <button type="button" onClick={closeFileUploadForm} disabled={isUploadingFile} className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-brand px-5 text-sm font-semibold text-brand-dark transition hover:bg-brand-soft disabled:opacity-60 sm:w-auto">İptal</button>
                <button type="button" onClick={() => void handleUploadFile()} disabled={isUploadingFile || !selectedUploadFile} className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-brand-dark px-6 text-sm font-semibold text-white transition hover:bg-brand disabled:opacity-60 sm:w-auto">{isUploadingFile ? 'Yükleniyor…' : 'Dosyayı yükle'}</button>
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
            <div className="mt-4 rounded-xl border border-dashed border-canvas-border bg-canvas px-4 py-9 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-violet-50 text-violet-700"><EventIcon name="file" className="h-5 w-5" /></span>
              <p className="mt-3 text-sm font-semibold text-ink">Henüz dosya eklenmedi</p>
              <p className="mt-1 text-xs text-ink-soft">Etkinlik belgeleri burada listelenecek.</p>
            </div>
          )}
          {filesLoadState === 'ready' && files.length > 0 && (
            <div className="mt-4 flex flex-col gap-4">
              {files.map((file) => (
                <div
                  key={file.id}
                  className={`rounded-xl border p-4 ${
                    file.deletedAt ? 'border-red-200 bg-red-50/40' : 'border-canvas-border bg-canvas'
                  }`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3 overflow-hidden">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700"><EventIcon name="file" className="h-4.5 w-4.5" /></span>
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
                      <div className="mt-3 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => void handleDownloadFile(file)}
                          disabled={downloadingFileId === file.id}
                          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-brand/40 bg-canvas px-3 text-xs font-semibold text-brand-dark hover:bg-brand-soft disabled:opacity-60"
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
                    </div>
                    {canEdit && !file.deletedAt && (
                      <div className="flex shrink-0 items-center">
                        <button
                          type="button"
                          onClick={() => void handleDeactivateFile(file.id)}
                          disabled={deactivatingFileId === file.id}
                          className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 sm:w-auto"
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
                        className="inline-flex min-h-10 w-full shrink-0 items-center justify-center rounded-lg border border-green-200 bg-green-50 px-3 text-xs font-semibold text-green-700 disabled:opacity-50 sm:w-auto"
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

        <div className={activeDetailTab === 'operations' ? 'mt-6 flex flex-col gap-4' : 'hidden'}>
        {/* SKS Süreci */}
        <section className="order-2 rounded-xl border border-canvas-border bg-canvas-surface p-4 shadow-card">
          <button type="button" onClick={() => setIsSksSectionOpen((open) => !open)} aria-expanded={isSksSectionOpen} className="flex min-h-[44px] w-full items-center justify-between gap-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
            <div className="flex items-center gap-3"><EventIconBadge name="sks" /><div><h2 className="text-base font-semibold text-ink">SKS</h2><p className="mt-1 text-xs text-ink-soft">SKS durumu ve SKS ekibini yönetin.</p></div></div>
            <div className="flex items-center gap-2">
              <span className="hidden rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-dark sm:inline-flex">{event.sksStatus ? (availableSksStatuses.find((status) => status.slug === event.sksStatus)?.label ?? event.sksStatus) : 'Belirtilmemiş'}</span>
              <span aria-hidden="true" className={`text-xl text-ink-soft transition-transform ${isSksSectionOpen ? 'rotate-180' : ''}`}>⌄</span>
            </div>
          </button>
          <div className={isSksSectionOpen ? 'mt-4 flex flex-col gap-4 border-t border-canvas-border pt-4' : 'hidden'}>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
              <section className="rounded-xl border border-canvas-border bg-canvas p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <EventIconBadge name="sks" />
                  <div>
                    <h3 className="text-sm font-semibold text-ink">SKS durumu</h3>
                    <p className="mt-0.5 text-xs text-ink-soft">Resmî süreçteki güncel aşama.</p>
                  </div>
                </div>

                <div className="mt-5">
                  {canChangeSksStatus ? (
                    <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                      Güncel durum
                      <select
                        value={event.sksStatus ?? ''}
                        onChange={(e) => void handleUpdateSksStatus(e.target.value)}
                        disabled={isUpdatingSksStatus || availableSksStatuses.length === 0}
                        className="min-h-11 w-full rounded-lg border border-canvas-border bg-canvas-surface px-3 py-2.5 text-sm font-medium normal-case tracking-normal text-ink outline-none transition focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <option value="" disabled>Durum seçin</option>
                        {availableSksStatuses.map((status) => <option key={status.slug} value={status.slug}>{status.label}</option>)}
                      </select>
                    </label>
                  ) : (
                    <div className="rounded-xl border border-brand/15 bg-brand-soft/30 px-4 py-4">
                      <p className="text-xs font-medium text-ink-soft">Güncel durum</p>
                      <p className="mt-1 text-base font-semibold text-ink">
                        {event.sksStatus ? (availableSksStatuses.find((status) => status.slug === event.sksStatus)?.label ?? event.sksStatus) : 'Belirtilmemiş'}
                      </p>
                    </div>
                  )}
                  {isUpdatingSksStatus && <p className="mt-3 text-xs text-ink-soft">Durum kaydediliyor…</p>}
                  {updateSksStatusError && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{updateSksStatusError}</p>}
                  {updateSksStatusSuccess && <p className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{updateSksStatusSuccess}</p>}
                </div>
              </section>

              <section className="rounded-xl border border-canvas-border bg-canvas p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-ink">SKS ekibi</h3>
                    <p className="mt-1 text-xs text-ink-soft">Süreçte görev alan ve bilgilendirilen üyeler.</p>
                  </div>
                  {canManageSksTeam && (
                    <button
                      type="button"
                      onClick={() => setIsSksPanelOpen((open) => !open)}
                      className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-brand/40 px-3 text-xs font-semibold text-brand-dark transition hover:bg-brand-soft sm:w-auto"
                    >
                      {isSksPanelOpen ? 'Yönetimi kapat' : 'Ekibi yönet'}
                    </button>
                  )}
                </div>

                {processMembersLoadState === 'loading' && <p className="mt-4 text-sm text-ink-soft">SKS ekibi yükleniyor…</p>}
                {processMembersLoadState === 'error' && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">SKS ekibi yüklenirken bir hata oluştu.</p>}
                {processMembersLoadState === 'ready' && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {(['owner', 'supporting', 'informed'] as const).map((responsibilityType) => {
                      const members = sksMembers.filter((member) => member.responsibilityType === responsibilityType)
                      const label = responsibilityType === 'owner' ? 'Ana sorumlu' : responsibilityType === 'supporting' ? 'Destekleyen' : 'Bilgilendirilen'
                      return (
                        <div key={responsibilityType} className="min-w-0 rounded-xl border border-canvas-border bg-canvas-surface p-3.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-ink-soft">{label}</p>
                            <span className="rounded-full bg-canvas px-2 py-0.5 text-[11px] font-semibold text-ink-soft">{members.length}</span>
                          </div>
                          {members.length > 0 ? (
                            <div className="mt-3 flex flex-col gap-2">
                              {members.map((member) => (
                                <div key={member.id} className="flex min-w-0 items-center gap-2">
                                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-dark">
                                    {member.displayName.trim().charAt(0).toLocaleUpperCase('tr-TR') || '?'}
                                  </span>
                                  <span className="truncate text-sm font-medium text-ink">{member.displayName}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-3 text-xs italic text-ink-soft">Atanmamış</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            </div>

            {isSksPanelOpen && canManageSksTeam && (
              <section className="overflow-hidden rounded-xl border border-canvas-border bg-canvas shadow-card">
                <div className="flex items-center justify-between gap-3 border-b border-canvas-border px-4 py-3 sm:px-5">
                  <div className="flex items-center gap-3">
                    <EventIconBadge name="person" />
                    <div>
                      <h4 className="text-sm font-semibold text-ink">SKS ekip yönetimi</h4>
                      <p className="mt-0.5 text-xs text-ink-soft">Üye ekleyin veya mevcut üyeleri kaldırın.</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setIsSksPanelOpen(false)} aria-label="SKS ekip yönetimini kapat" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-canvas-border text-lg text-ink-soft hover:bg-canvas-surface">×</button>
                </div>

                <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                  <div className="rounded-xl border border-canvas-border bg-canvas-surface p-4">
                    <h5 className="text-sm font-semibold text-ink">Yeni ekip üyesi</h5>
                    <p className="mt-1 text-xs text-ink-soft">Üyeyi ve süreçteki rolünü seçin.</p>
                    <div className="mt-4 flex flex-col gap-3">
                      <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                        Üye
                        <select value={sksSelectedProfileId} onChange={(e) => setSksSelectedProfileId(e.target.value)} disabled={isAssigningSks || periodMembersLoadState === 'loading'} className="min-h-11 w-full rounded-lg border border-canvas-border bg-canvas px-3 py-2.5 text-sm font-medium normal-case tracking-normal text-ink outline-none focus:border-brand disabled:opacity-60">
                          <option value="">Üye seçin</option>
                          {periodMembers.filter((member) => !sksMembers.some((assignedMember) => assignedMember.profileId === member.profileId)).map((member) => <option key={member.profileId} value={member.profileId}>{member.displayName}</option>)}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                        Sorumluluk türü
                        <select value={sksSelectedResponsibility} onChange={(e) => setSksSelectedResponsibility(e.target.value)} disabled={isAssigningSks} className="min-h-11 w-full rounded-lg border border-canvas-border bg-canvas px-3 py-2.5 text-sm font-medium normal-case tracking-normal text-ink outline-none focus:border-brand disabled:opacity-60">
                          <option value="owner">Ana sorumlu</option><option value="supporting">Destekleyen</option><option value="informed">Bilgilendirilen</option>
                        </select>
                      </label>
                      <button type="button" onClick={() => void handleAssignSksMember()} disabled={isAssigningSks} className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-brand-dark px-4 text-sm font-semibold text-white transition hover:bg-brand disabled:opacity-60">{isAssigningSks ? 'Ekleniyor…' : '+ Ekip üyesi ekle'}</button>
                    </div>
                    {assignSksError && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{assignSksError}</p>}
                  </div>

                  <div className="rounded-xl border border-canvas-border bg-canvas-surface p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div><h5 className="text-sm font-semibold text-ink">Eklenen üyeler</h5><p className="mt-1 text-xs text-ink-soft">SKS sürecindeki güncel ekip.</p></div>
                      <span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold text-ink-soft">{sksMembers.length}</span>
                    </div>
                    {sksMembers.length === 0 ? (
                      <div className="mt-4 rounded-xl border border-dashed border-canvas-border bg-canvas px-4 py-8 text-center"><p className="text-sm font-medium text-ink">Henüz ekip üyesi yok</p><p className="mt-1 text-xs text-ink-soft">Soldaki alandan ilk üyeyi ekleyebilirsiniz.</p></div>
                    ) : (
                      <div className="mt-4 flex flex-col gap-2">
                        {sksMembers.map((member) => {
                          const responsibilityLabel = member.responsibilityType === 'owner' ? 'Ana sorumlu' : member.responsibilityType === 'supporting' ? 'Destekleyen' : 'Bilgilendirilen'
                          return (
                            <div key={member.id} className="flex flex-col gap-3 rounded-xl border border-canvas-border bg-canvas p-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand-dark">{member.displayName.trim().charAt(0).toLocaleUpperCase('tr-TR') || '?'}</span><div className="min-w-0"><p className="truncate text-sm font-semibold text-ink">{member.displayName}</p><p className="mt-0.5 text-xs text-ink-soft">{responsibilityLabel}</p></div></div>
                              <button type="button" onClick={() => void handleRemoveSksMember(member.id)} disabled={removingSksMemberId === member.id} className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 sm:w-auto">{removingSksMemberId === member.id ? 'Kaldırılıyor…' : 'Kaldır'}</button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {removeSksError && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{removeSksError}</p>}
                  </div>
                </div>
              </section>
            )}
          </div>
        </section>

        {/* Bütçe Süreci */}
        {hasBudgetAccess ? <section id="event-budget" className="order-3 scroll-mt-28 rounded-xl border border-canvas-border bg-canvas-surface p-4 shadow-card">
          <button type="button" onClick={() => setIsBudgetSectionOpen((open) => !open)} aria-expanded={isBudgetSectionOpen} className="flex min-h-[44px] w-full items-center justify-between gap-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
            <div className="flex items-center gap-3"><EventIconBadge name="budget" /><div><h2 className="text-base font-semibold text-ink">Bütçe ve sponsorlar</h2><p className="mt-1 text-xs text-ink-soft">Bütçe durumunu ve sponsor kayıtlarını yönetin.</p></div></div>
            <span aria-hidden="true" className={`text-xl text-ink-soft transition-transform ${isBudgetSectionOpen ? 'rotate-180' : ''}`}>⌄</span>
          </button>
          <div className={isBudgetSectionOpen ? 'mt-4 border-t border-canvas-border pt-4' : 'hidden'}>
          <div className="flex items-start justify-between gap-4">
            <div><h3 className="text-sm font-semibold uppercase tracking-wide text-ink">Bütçe özeti</h3><p className="mt-1 text-xs text-ink-soft">Bütçe durumunu ve harcamaları tek yerden yönetin.</p></div>
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
                <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
                   <label className="grid gap-2 text-sm font-medium text-ink">
                      Bütçe durumu
                      <span className="relative block">
                      <span className="pointer-events-none absolute inset-y-0 left-4 z-10 flex items-center"><span className="h-3 w-3 rounded-full bg-emerald-500 ring-8 ring-emerald-100" /></span>
                      <select
                         value={editBudgetStatus}
                         onChange={(e) => setEditBudgetStatus(e.target.value)}
                         disabled={isSavingBudget || availableBudgetStatuses.length === 0}
                         className="min-h-[54px] w-full appearance-none rounded-xl border border-canvas-border bg-canvas-surface py-3 pl-12 pr-11 text-sm font-normal text-ink transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-60"
                      >
                         <option value="">Durum seçin</option>
                         {availableBudgetStatuses.map((status) => <option key={status.slug} value={status.slug}>{status.label}</option>)}
                      </select>
                      <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-brand-dark">⌄</span>
                      </span>
                   </label>
                   <label className="grid gap-2 text-sm font-medium text-ink">
                      Tahmini bütçe (₺)
                      <span className="flex min-h-[54px] overflow-hidden rounded-xl border border-canvas-border bg-canvas-surface transition focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
                      <span className="flex w-12 shrink-0 items-center justify-center border-r border-canvas-border bg-brand-soft/60 text-base font-semibold text-brand-dark">₺</span>
                      <input
                         type="number"
                         inputMode="decimal"
                         step="0.01"
                         min="0"
                         value={editEstimatedBudget}
                         onChange={(e) => setEditEstimatedBudget(e.target.value)}
                         disabled={isSavingBudget}
                         placeholder="0,00"
                         className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm font-normal text-ink outline-none disabled:opacity-60"
                      />
                      </span>
                   </label>
                   <label className="grid gap-2 text-sm font-medium text-ink">
                      Onaylanan bütçe (₺)
                      <span className="flex min-h-[54px] overflow-hidden rounded-xl border border-canvas-border bg-canvas-surface transition focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
                      <span className="flex w-12 shrink-0 items-center justify-center border-r border-canvas-border bg-brand-soft/60 text-base font-semibold text-brand-dark">₺</span>
                      <input
                         type="number"
                         inputMode="decimal"
                         step="0.01"
                         min="0"
                         value={editApprovedBudget}
                         onChange={(e) => setEditApprovedBudget(e.target.value)}
                         disabled={isSavingBudget}
                         placeholder="0,00"
                         className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm font-normal text-ink outline-none disabled:opacity-60"
                      />
                      </span>
                   </label>
                   <label className="grid gap-2 text-sm font-medium text-ink">
                      Gerçekleşen harcama (₺)
                      <span className="flex min-h-[54px] overflow-hidden rounded-xl border border-canvas-border bg-canvas-surface transition focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
                      <span className="flex w-12 shrink-0 items-center justify-center border-r border-canvas-border bg-brand-soft/60 text-base font-semibold text-brand-dark">₺</span>
                      <input
                         type="number"
                         inputMode="decimal"
                         step="0.01"
                         min="0"
                         value={editActualExpense}
                         onChange={(e) => setEditActualExpense(e.target.value)}
                         disabled={isSavingBudget}
                         placeholder="0,00"
                         className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm font-normal text-ink outline-none disabled:opacity-60"
                      />
                      </span>
                   </label>
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

                <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => { setIsEditingBudget(false); setBudgetSaveError(null); }}
                    disabled={isSavingBudget}
                    className="min-h-[44px] rounded-md border border-canvas-border px-5 py-2 text-sm font-medium text-ink-soft disabled:opacity-60"
                  >
                    İptal
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveBudget()}
                    disabled={isSavingBudget}
                    className="min-h-[44px] rounded-md bg-brand-dark px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {isSavingBudget ? 'Kaydediliyor…' : 'Kaydet'}
                  </button>
                </div>
             </div>
          ) : (
             <div className="mt-4">
                <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4"><p className="text-xs font-medium text-ink-soft">Tahmini bütçe</p><p className="mt-2 text-lg font-semibold text-ink">{formatCurrency(event.estimatedBudget)}</p></div>
                  <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4"><p className="text-xs font-medium text-ink-soft">Onaylanan bütçe</p><p className="mt-2 text-lg font-semibold text-ink">{formatCurrency(event.approvedBudget)}</p></div>
                  <div className="rounded-xl border border-red-200 bg-red-50/60 p-4"><p className="text-xs font-medium text-ink-soft">Gerçekleşen harcama</p><p className="mt-2 text-lg font-semibold text-ink">{formatCurrency(event.actualExpense)}</p></div>
                  <div className={`rounded-xl border p-4 ${remainingBudget !== null && remainingBudget < 0 ? 'border-red-200 bg-red-50/60' : 'border-amber-200 bg-amber-50/60'}`}><p className="text-xs font-medium text-ink-soft">Kalan bütçe</p><p className={`mt-2 text-lg font-semibold ${remainingBudget !== null && remainingBudget < 0 ? 'text-danger' : 'text-brand-dark'}`}>{formatCurrency(remainingBudget)}</p></div>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
                  <div className="rounded-xl border border-canvas-border bg-canvas p-4"><p className="text-xs font-medium text-ink-soft">Bütçe durumu</p><p className="mt-2 text-sm font-semibold text-ink">{event.budgetStatus ? (availableBudgetStatuses.find(s => s.slug === event.budgetStatus)?.label ?? event.budgetStatus) : NOT_SPECIFIED}</p></div>
                  <div className="rounded-xl border border-canvas-border bg-canvas p-4"><p className="text-xs font-medium text-ink-soft">Bütçe notu</p><p className="mt-2 whitespace-pre-wrap text-sm text-ink">{event.budgetNote || NOT_SPECIFIED}</p></div>
                </div>
             </div>
          )}

          <div className="mt-5 rounded-xl border border-brand/15 bg-brand-soft/35 p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark">Ana sorumlu</p>
            {periodMembersLoadState === 'loading' ? <p className="mt-2 text-sm text-ink-soft">Sayman bilgisi yükleniyor…</p> : treasurerMember ? (
              <div className="mt-2 flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-dark font-semibold text-white">{treasurerMember.displayName.slice(0, 1).toLocaleUpperCase('tr-TR')}</span>
                <div><p className="font-semibold text-ink">{treasurerMember.displayName}</p><p className="text-xs text-ink-soft">Sayman · Bütçe ana sorumlusu</p></div>
              </div>
            ) : <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Aktif dönemde Sayman ataması bulunmuyor.</p>}
            <p className="mt-3 text-xs text-ink-soft">Bütçe sorumluluğu aktif dönemin Saymanına otomatik olarak verilir; ayrıca ekip üyesi eklenmez.</p>
          </div>

          {/* Sponsorlar Bölümü */}
          <div className="mt-5 rounded-xl border border-canvas-border bg-canvas p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-4">
              <div><h2 className="text-sm font-semibold uppercase tracking-wide text-ink">Sponsorlar</h2><p className="mt-1 text-xs text-ink-soft">{activeSponsors.length} aktif sponsor · Toplam {formatCurrency(sponsorTotal)}</p></div>
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
                className="flex min-h-[42px] shrink-0 items-center justify-center rounded-md bg-brand-dark px-4 text-sm font-medium text-white hover:brightness-95"
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
            <div className="mt-4 overflow-hidden rounded-xl border border-canvas-border bg-canvas-surface shadow-card">
              <div className="flex items-center justify-between gap-3 border-b border-canvas-border px-4 py-3 sm:px-5">
                <div className="flex items-center gap-3"><EventIconBadge name="budget" /><div><h3 className="text-sm font-semibold text-ink">{sponsorFormMode === 'create' ? 'Yeni sponsor' : 'Sponsoru düzenle'}</h3><p className="mt-0.5 text-xs text-ink-soft">Sponsor bilgilerini ve destek tutarını kaydedin.</p></div></div>
                <button type="button" onClick={closeSponsorForm} disabled={isSavingSponsor} aria-label="Sponsor formunu kapat" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl text-ink-soft hover:bg-canvas disabled:opacity-60">×</button>
              </div>
              <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(12rem,0.6fr)] sm:p-5">
                <label htmlFor="sponsor-name" className="grid gap-1.5 text-sm font-medium text-ink-soft">
                    Sponsor adı
                  <input
                    id="sponsor-name"
                    type="text"
                    value={sponsorName}
                    onChange={(e) => setSponsorName(e.target.value)}
                    disabled={isSavingSponsor}
                    placeholder="Sponsor kurum veya kişi adı"
                    className="min-h-[44px] rounded-md border border-canvas-border bg-canvas px-3 py-2 text-sm font-normal text-ink"
                  />
                </label>
                <label htmlFor="sponsor-amount" className="grid gap-1.5 text-sm font-medium text-ink-soft">
                    Destek tutarı (₺)
                  <input
                    id="sponsor-amount"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={sponsorAmount}
                    onChange={(e) => setSponsorAmount(e.target.value)}
                    disabled={isSavingSponsor}
                    placeholder="0,00"
                    className="min-h-[44px] rounded-md border border-canvas-border bg-canvas px-3 py-2 text-sm font-normal text-ink"
                  />
                </label>
                <label htmlFor="sponsor-note" className="grid gap-1.5 text-sm font-medium text-ink-soft sm:col-span-2">
                    Not <span className="sr-only">isteğe bağlı</span>
                  <textarea
                    id="sponsor-note"
                    value={sponsorNote}
                    onChange={(e) => setSponsorNote(e.target.value)}
                    disabled={isSavingSponsor}
                    rows={3}
                    maxLength={500}
                    placeholder="Sponsorluk kapsamı veya ek açıklama (isteğe bağlı)"
                    className="resize-y rounded-md border border-canvas-border bg-canvas px-3 py-2 text-sm font-normal text-ink"
                  />
                  <span className="text-right text-[11px] font-normal text-ink-soft">{sponsorNote.length}/500</span>
                </label>
                {sponsorFormError && (
                  <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">
                    {sponsorFormError}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-3 border-t border-canvas-border bg-canvas/50 px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
                  <button
                    type="button"
                    onClick={closeSponsorForm}
                    disabled={isSavingSponsor}
                    className="min-h-[44px] rounded-md border border-canvas-border px-5 py-2 text-sm font-medium text-ink-soft disabled:opacity-60"
                  >
                    İptal
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveSponsor()}
                    disabled={isSavingSponsor}
                    className="min-h-[44px] rounded-md bg-brand-dark px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {isSavingSponsor ? 'Kaydediliyor…' : 'Kaydet'}
                  </button>
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
          {sponsorsLoadState === 'ready' && sponsors.length === 0 && !isSponsorFormOpen && (
            <p className="mt-3 text-sm italic text-ink-soft">Bu etkinlik için henüz sponsor eklenmemiş.</p>
          )}
          {sponsorsLoadState === 'ready' && sponsors.length > 0 && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
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
        </section> : null}

        <EventCoordinatorsPanel eventId={eventId ?? ''} />

        <section id="event-tasks" className="order-1 scroll-mt-28 rounded-xl border border-canvas-border bg-canvas-surface p-4 shadow-card sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3"><EventIconBadge name="task" /><div><h2 className="text-base font-semibold text-ink">Görevler</h2><p className="mt-1 text-xs text-ink-soft">Etkinliğe bağlı görevleri yönetin.</p></div></div>
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
            <div className="mt-4 overflow-hidden rounded-xl border border-canvas-border bg-canvas shadow-card">
              <div className="flex items-center justify-between gap-3 border-b border-canvas-border bg-canvas-surface px-4 py-3 sm:px-5">
                <div className="flex items-center gap-3"><EventIconBadge name="task" /><div><h3 className="text-sm font-semibold text-ink">Yeni görev oluştur</h3><p className="mt-0.5 text-xs text-ink-soft">Görevin kapsamını, zamanını ve ana sorumlusunu belirleyin.</p></div></div>
                <button type="button" onClick={cancelTaskForm} disabled={isCreatingTask} aria-label="Görev formunu kapat" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl text-ink-soft hover:bg-canvas disabled:opacity-60">×</button>
              </div>
              <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(16rem,0.55fr)] lg:p-5">
                <section className="rounded-xl border border-canvas-border bg-canvas-surface p-4">
                  <div className="flex items-center gap-2"><EventIconBadge name="content" /><h4 className="text-sm font-semibold text-ink">Görev bilgileri</h4></div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-1.5 text-xs font-medium text-ink-soft sm:col-span-2">Görev adı<input id="task-title" type="text" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} disabled={isCreatingTask} placeholder="Yapılacak işi kısa ve net yazın" className="min-h-[44px] rounded-md border border-canvas-border bg-canvas px-3 py-2 text-sm font-normal text-ink" /></label>
                    <label className="grid gap-1.5 text-xs font-medium text-ink-soft sm:col-span-2">Açıklama<textarea id="task-description" value={newTaskDescription} onChange={(e) => setNewTaskDescription(e.target.value)} disabled={isCreatingTask} rows={4} placeholder="Görevin kapsamını ve beklenen sonucu açıklayın" className="resize-y rounded-md border border-canvas-border bg-canvas px-3 py-2 text-sm font-normal text-ink" /></label>
                    <label className="grid gap-1.5 text-xs font-medium text-ink-soft">Son tarih<input id="task-deadline" type="datetime-local" value={newTaskDeadline} onChange={(e) => setNewTaskDeadline(e.target.value)} disabled={isCreatingTask} className="min-h-[44px] rounded-md border border-canvas-border bg-canvas px-3 py-2 text-sm font-normal text-ink" /></label>
                    <label className="grid gap-1.5 text-xs font-medium text-ink-soft">Öncelik<select id="task-priority" value={newTaskPriority} onChange={(e) => setNewTaskPriority(e.target.value)} disabled={isCreatingTask} className="min-h-[44px] rounded-md border border-canvas-border bg-canvas px-3 py-2 text-sm font-normal text-ink">{TASK_PRIORITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                  </div>
                </section>

                <aside className="rounded-xl border border-canvas-border bg-canvas-surface p-4">
                  <div className="flex items-center gap-2"><EventIconBadge name="person" /><h4 className="text-sm font-semibold text-ink">Sorumluluk</h4></div>
                  <label className="mt-4 grid gap-1.5 text-xs font-medium text-ink-soft">Ana sorumlu <span className="sr-only">isteğe bağlı</span><select id="task-primary-assignee" value={newTaskPrimaryProfileId} onChange={(e) => setNewTaskPrimaryProfileId(e.target.value)} disabled={isCreatingTask || periodMembersLoadState === 'loading'} className="min-h-[44px] rounded-md border border-canvas-border bg-canvas px-3 py-2 text-sm font-normal text-ink disabled:opacity-60"><option value="">{periodMembersLoadState === 'loading' ? 'Koordinatörler yükleniyor…' : 'Atanmamış bırak'}</option>{periodMembers.map((member) => <option key={member.profileId} value={member.profileId}>{member.displayName}{member.coordinatorRoleName ? ` — ${member.coordinatorRoleName}` : ''}</option>)}</select></label>
                  <p className="mt-3 rounded-lg border border-brand/15 bg-brand-soft/40 p-3 text-xs leading-5 text-ink-soft">Destekleyen ve bilgilendirilen kişiler görev oluşturulduktan sonra Atama yönetiminden eklenebilir.</p>
                  {periodMembersLoadState === 'error' ? <p className="mt-3 text-xs text-danger">Koordinatör listesi yüklenemedi. Görevi atanmamış oluşturabilirsiniz.</p> : null}
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs"><div className="rounded-lg border border-canvas-border bg-canvas p-3"><p className="text-ink-soft">Öncelik</p><p className="mt-1 font-semibold text-ink">{TASK_PRIORITY_LABELS[newTaskPriority] ?? newTaskPriority}</p></div><div className="rounded-lg border border-canvas-border bg-canvas p-3"><p className="text-ink-soft">Ana sorumlu</p><p className="mt-1 truncate font-semibold text-ink">{periodMembers.find((member) => member.profileId === newTaskPrimaryProfileId)?.displayName ?? 'Atanmamış'}</p></div></div>
                </aside>
                {createTaskError ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 lg:col-span-2">{createTaskError}</p> : null}
              </div>
              <div className="flex flex-col gap-2 border-t border-canvas-border bg-canvas-surface px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
                <button type="button" onClick={cancelTaskForm} disabled={isCreatingTask} className="min-h-[44px] rounded-md border border-canvas-border px-5 text-sm font-medium text-ink-soft disabled:opacity-60">İptal</button>
                <button type="button" onClick={handleCreateTask} disabled={isCreatingTask} className="min-h-[44px] rounded-md bg-brand-dark px-6 text-sm font-medium text-white disabled:opacity-60">{isCreatingTask ? 'Oluşturuluyor…' : 'Görevi oluştur'}</button>
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
              {[...tasks].sort((a, b) => Number(b.progressStatusSlug === 'completed') - Number(a.progressStatusSlug === 'completed')).map((task) => {
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
                    onActivateTask={handleActivateTask}
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
        </section>
        </div>

        {isAnnouncementStatusEditorOpen ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-0 backdrop-blur-[1px] sm:items-center sm:p-6 lg:pl-[calc(15rem+1.5rem)]">
            <button type="button" aria-label="Duyuru ve yayın düzenleme penceresini kapat" tabIndex={-1} onClick={() => !isUpdatingAnnouncementStatus && setIsAnnouncementStatusEditorOpen(false)} disabled={isUpdatingAnnouncementStatus} className="absolute inset-0 disabled:cursor-wait" />
            <section role="dialog" aria-modal="true" aria-labelledby="announcement-status-dialog-title" className="relative w-full overflow-hidden rounded-t-2xl border border-canvas-border bg-canvas-surface shadow-2xl sm:max-w-lg sm:rounded-2xl" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
              <div className="flex items-start justify-between gap-4 border-b border-canvas-border px-4 py-4 sm:px-5">
                <div className="flex min-w-0 items-center gap-3"><EventIconBadge name="operations" /><div><h2 id="announcement-status-dialog-title" className="text-lg font-semibold text-ink">Duyuru / Yayın durumu</h2><p className="mt-1 text-xs leading-5 text-ink-soft">İçerik hazırlığı ve yayın aşamasını güncelleyin.</p></div></div>
                <button type="button" onClick={() => setIsAnnouncementStatusEditorOpen(false)} disabled={isUpdatingAnnouncementStatus} aria-label="Kapat" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-canvas-border text-xl leading-none text-ink-soft hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60">×</button>
              </div>
              <div className="p-4 sm:p-5">
                <label htmlFor="announcement-status-quick-edit" className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  Süreç durumu
                  <select id="announcement-status-quick-edit" autoFocus value={announcementStatusDraft} onChange={(e) => setAnnouncementStatusDraft(e.target.value)} disabled={isUpdatingAnnouncementStatus || availableEventAnnouncementStatuses.length === 0} className="min-h-11 rounded-lg border border-canvas-border bg-canvas px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10 disabled:opacity-60">
                    {availableEventAnnouncementStatuses.map((status) => <option key={status.slug} value={status.slug}>{status.label}</option>)}
                  </select>
                </label>
                {announcementStatusError ? <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{announcementStatusError}</p> : null}
              </div>
              <div className="flex flex-col-reverse gap-2 border-t border-canvas-border bg-canvas px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
                <button type="button" onClick={() => setIsAnnouncementStatusEditorOpen(false)} disabled={isUpdatingAnnouncementStatus} className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-brand px-5 text-sm font-semibold text-brand-dark transition hover:bg-brand-soft disabled:opacity-60 sm:w-auto">İptal</button>
                <button type="button" onClick={() => void handleSaveAnnouncementStatus()} disabled={isUpdatingAnnouncementStatus} className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-brand-dark px-6 text-sm font-semibold text-white transition hover:bg-brand disabled:opacity-60 sm:w-auto">{isUpdatingAnnouncementStatus ? 'Kaydediliyor…' : 'Durumu kaydet'}</button>
              </div>
            </section>
          </div>
        ) : null}

        {isDesignStatusEditorOpen ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-0 backdrop-blur-[1px] sm:items-center sm:p-6 lg:pl-[calc(15rem+1.5rem)]">
            <button type="button" aria-label="Süreç düzenleme penceresini kapat" tabIndex={-1} onClick={() => !isUpdatingDesignAnnouncementStatus && setIsDesignStatusEditorOpen(false)} disabled={isUpdatingDesignAnnouncementStatus} className="absolute inset-0 disabled:cursor-wait" />
            <section role="dialog" aria-modal="true" aria-labelledby="design-status-dialog-title" className="relative w-full overflow-hidden rounded-t-2xl border border-canvas-border bg-canvas-surface shadow-2xl sm:max-w-lg sm:rounded-2xl" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
              <div className="flex items-start justify-between gap-4 border-b border-canvas-border px-4 py-4 sm:px-5">
                <div className="flex min-w-0 items-center gap-3"><EventIconBadge name="operations" /><div><h2 id="design-status-dialog-title" className="text-lg font-semibold text-ink">Tasarım durumu</h2><p className="mt-1 text-xs leading-5 text-ink-soft">Brief, tasarım ve revize aşamasını güncelleyin.</p></div></div>
                <button type="button" onClick={() => setIsDesignStatusEditorOpen(false)} disabled={isUpdatingDesignAnnouncementStatus} aria-label="Kapat" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-canvas-border text-xl leading-none text-ink-soft hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60">×</button>
              </div>
              <div className="p-4 sm:p-5">
                <label htmlFor="design-status-quick-edit" className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  Süreç durumu
                  <select id="design-status-quick-edit" autoFocus value={designStatusDraft} onChange={(e) => setDesignStatusDraft(e.target.value)} disabled={isUpdatingDesignAnnouncementStatus || availableEventDesignAnnouncementStatuses.length === 0} className="min-h-11 rounded-lg border border-canvas-border bg-canvas px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10 disabled:opacity-60">
                    {availableEventDesignAnnouncementStatuses.filter((status) => status.slug !== 'published').map((status) => <option key={status.slug} value={status.slug}>{status.label}</option>)}
                  </select>
                </label>
                <p className="mt-3 text-xs leading-5 text-ink-soft">Tasarım hazır olduğunda Duyuru / Yayın süreci ayrı olarak takip edilir.</p>
                {designAnnouncementStatusError ? <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{designAnnouncementStatusError}</p> : null}
              </div>
              <div className="flex flex-col-reverse gap-2 border-t border-canvas-border bg-canvas px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
                <button type="button" onClick={() => setIsDesignStatusEditorOpen(false)} disabled={isUpdatingDesignAnnouncementStatus} className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-brand px-5 text-sm font-semibold text-brand-dark transition hover:bg-brand-soft disabled:opacity-60 sm:w-auto">İptal</button>
                <button type="button" onClick={() => void handleSaveDesignStatus()} disabled={isUpdatingDesignAnnouncementStatus} className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-brand-dark px-6 text-sm font-semibold text-white transition hover:bg-brand disabled:opacity-60 sm:w-auto">{isUpdatingDesignAnnouncementStatus ? 'Kaydediliyor…' : 'Durumu kaydet'}</button>
              </div>
            </section>
          </div>
        ) : null}

        {isDateEditorOpen ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-0 backdrop-blur-[1px] sm:items-center sm:p-6 lg:pl-[calc(15rem+1.5rem)]">
            <button
              type="button"
              aria-label="Tarih düzenleme penceresini kapat"
              tabIndex={-1}
              onClick={closeDateEditing}
              disabled={isSavingDates}
              className="absolute inset-0 disabled:cursor-wait"
            />
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="date-editor-dialog-title"
              className="relative w-full overflow-hidden rounded-t-2xl border border-canvas-border bg-canvas-surface shadow-2xl sm:max-w-2xl sm:rounded-2xl"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              <div className="flex items-start justify-between gap-4 border-b border-canvas-border px-4 py-4 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <EventIconBadge name="calendar" />
                  <div className="min-w-0">
                    <h2 id="date-editor-dialog-title" className="text-lg font-semibold text-ink">Tarihleri düzenle</h2>
                    <p className="mt-1 text-xs leading-5 text-ink-soft">Yalnızca etkinliğin planlama ve takvim tarihlerini güncelleyin.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeDateEditing}
                  disabled={isSavingDates}
                  aria-label="Kapat"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-canvas-border text-xl leading-none text-ink-soft hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60"
                >
                  ×
                </button>
              </div>

              <div className="p-4 sm:p-5">
                <section className="rounded-xl border border-canvas-border bg-canvas p-4">
                  <div className="flex items-center gap-3">
                    <EventIconBadge name="calendar" />
                    <div><h3 className="text-sm font-semibold text-ink">Etkinlik takvimi</h3><p className="mt-0.5 text-xs text-ink-soft">Hazırlık başlangıcı dahil tüm tarihler elle düzenlenebilir.</p></div>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label htmlFor="quick-planning-date" className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                      Planlama tarihi
                      <input id="quick-planning-date" type="date" value={editPlanningDate} onChange={(e) => setEditPlanningDate(e.target.value)} disabled={isSavingDates} className="min-h-11 rounded-lg border border-canvas-border bg-canvas-surface px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10 disabled:opacity-60" />
                    </label>
                    <label htmlFor="quick-preparation-date" className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                      Hazırlık başlangıcı
                      <input id="quick-preparation-date" type="date" value={editPreparationStartDate} onChange={(e) => setEditPreparationStartDate(e.target.value)} disabled={isSavingDates} className="min-h-11 rounded-lg border border-canvas-border bg-canvas-surface px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10 disabled:opacity-60" />
                    </label>
                    <label htmlFor="quick-estimated-date" className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                      Tahmini etkinlik tarihi
                      <input id="quick-estimated-date" type="date" value={editEstimatedDate} onChange={(e) => setEditEstimatedDate(e.target.value)} disabled={isSavingDates} className="min-h-11 rounded-lg border border-canvas-border bg-canvas-surface px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10 disabled:opacity-60" />
                    </label>
                    <label htmlFor="quick-confirmed-date" className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                      Kesinleşmiş tarih
                      <input id="quick-confirmed-date" type="date" value={editConfirmedDate} onChange={(e) => setEditConfirmedDate(e.target.value)} disabled={isSavingDates} className="min-h-11 rounded-lg border border-canvas-border bg-canvas-surface px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10 disabled:opacity-60" />
                    </label>
                  </div>
                </section>
                {dateSaveError ? <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{dateSaveError}</p> : null}
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-canvas-border bg-canvas px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
                <button type="button" onClick={closeDateEditing} disabled={isSavingDates} className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-brand px-5 text-sm font-semibold text-brand-dark transition hover:bg-brand-soft disabled:opacity-60 sm:w-auto">İptal</button>
                <button type="button" onClick={() => void handleSaveDates()} disabled={isSavingDates} className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-brand-dark px-6 text-sm font-semibold text-white transition hover:bg-brand disabled:opacity-60 sm:w-auto">{isSavingDates ? 'Kaydediliyor…' : 'Tarihleri kaydet'}</button>
              </div>
            </section>
          </div>
        ) : null}

        {editingProcessField ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-0 backdrop-blur-[1px] sm:items-center sm:p-6 lg:pl-[calc(15rem+1.5rem)]">
            <button
              type="button"
              aria-label="Düzenleme penceresini kapat"
              tabIndex={-1}
              onClick={closeProcessFieldEditing}
              disabled={isSavingProcessField}
              className="absolute inset-0 disabled:cursor-wait"
            />
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="process-field-dialog-title"
              className="relative w-full overflow-hidden rounded-t-2xl border border-canvas-border bg-canvas-surface shadow-2xl sm:max-w-xl sm:rounded-2xl"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              <div className="flex items-start justify-between gap-4 border-b border-canvas-border px-4 py-4 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <EventIconBadge name={editingProcessField === 'venue' ? 'pin' : 'task'} />
                  <div className="min-w-0">
                    <h2 id="process-field-dialog-title" className="text-lg font-semibold text-ink">
                      {editingProcessField === 'venue' ? 'Mekânı düzenle' : 'Sonraki işlemi düzenle'}
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-ink-soft">
                      {editingProcessField === 'venue'
                        ? 'Etkinliğin yapılacağı yeri belirtin.'
                        : 'Ekibin sıradaki somut adımını belirtin.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeProcessFieldEditing}
                  disabled={isSavingProcessField}
                  aria-label="Kapat"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-canvas-border text-xl leading-none text-ink-soft hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60"
                >
                  ×
                </button>
              </div>

              <div className="p-4 sm:p-5">
                <section className="rounded-xl border border-canvas-border bg-canvas p-4">
                  <div className="flex items-center gap-2"><EventIconBadge name={editingProcessField === 'venue' ? 'pin' : 'task'} /><div><h3 className="text-sm font-semibold text-ink">{editingProcessField === 'venue' ? 'Mekân bilgisi' : 'İşlem bilgisi'}</h3><p className="mt-0.5 text-xs text-ink-soft">{editingProcessField === 'venue' ? 'Etkinlikte kullanılacak alanı yazın.' : 'Ekibin uygulayacağı sıradaki adımı yazın.'}</p></div></div>
                  <label htmlFor="process-field-value" className="mt-4 flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                    {editingProcessField === 'venue' ? 'Mekân' : 'Sonraki işlem'}
                    {editingProcessField === 'venue' ? (
                      <input
                        id="process-field-value"
                        type="text"
                        autoFocus
                        value={processFieldValue}
                        onChange={(event) => setProcessFieldValue(event.target.value)}
                        disabled={isSavingProcessField}
                        placeholder="Örn. Konferans salonu"
                        className="min-h-11 rounded-lg border border-canvas-border bg-canvas-surface px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10 disabled:opacity-60"
                      />
                    ) : (
                      <textarea
                        id="process-field-value"
                        autoFocus
                        rows={5}
                        value={processFieldValue}
                        onChange={(event) => setProcessFieldValue(event.target.value)}
                        disabled={isSavingProcessField}
                        placeholder="Örn. Salon onayını al"
                        className="min-h-32 resize-y rounded-lg border border-canvas-border bg-canvas-surface px-3 py-3 text-sm font-normal normal-case leading-6 tracking-normal text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10 disabled:opacity-60"
                      />
                    )}
                  </label>
                </section>

                {processFieldError ? (
                  <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{processFieldError}</p>
                ) : null}
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-canvas-border bg-canvas px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
                <button
                  type="button"
                  onClick={closeProcessFieldEditing}
                  disabled={isSavingProcessField}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-brand px-5 text-sm font-semibold text-brand-dark transition hover:bg-brand-soft disabled:opacity-60 sm:w-auto"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveProcessField()}
                  disabled={isSavingProcessField}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-brand-dark px-6 text-sm font-semibold text-white transition hover:bg-brand disabled:opacity-60 sm:w-auto"
                >
                  {isSavingProcessField ? 'Kaydediliyor…' : 'Değişiklikleri kaydet'}
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </main>
    </AppShell>
  )
}
