import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useMembershipStatus } from '../hooks/useMembershipStatus'
import AppShell from '../components/AppShell'
import NormalDashboardView from '../components/dashboard/NormalDashboardView'
import SuperAdminDashboardView from '../components/dashboard/SuperAdminDashboardView'
import type { AiHomeSummary } from '../components/dashboard/AiHomeSummaryCard'
import type {
  DashboardActivityViewItem,
  DashboardNotificationViewItem,
  DashboardResponsibilityViewItem,
  DashboardTaskViewItem,
} from '../components/dashboard/NormalDashboardView'
import type { WeeklyAgendaItem } from '../components/dashboard/WeeklyAgendaCard'
import type { TaskStatusTone } from '../components/TaskStatusBadge'

interface DashboardEvent {
  id: string
  title: string
  effectiveDate: string | null
  eventStatus: string | null
  ownerId: string
  createdAt: string
}

interface DashboardAwareness {
  id: string
  title: string
  shareDate: string | null
  estimatedDate: string | null
  startDate: string | null
  createdBy: string
  designResponsibleId: string | null
  pressResponsibleId: string | null
}

interface DashboardTask {
  id: string
  eventId: string | null
  eventTitle: string
  title: string
  deadlineAt: string | null
  progressStatusSlug: string | null
  progressStatusLabel: string | null
  assignmentLabel?: string
}

interface DashboardAssignment {
  task_id: string
  profile_id: string
  assignment_type: string
}

interface DashboardResponsibility {
  id: string
  title: string
  kind: 'event' | 'awareness' | 'manual'
  kindLabel: string
  date: string | null
  href: string
}

interface MyTask extends DashboardTask {
  assignmentType: string
  assignmentLabel: string
}

interface DashboardData {
  activeEventCount: number
  openTaskCount: number
  myOpenTaskCount: number
  overdueTaskCount: number
  myOverdueTaskCount: number
  managedEventCount: number
  managedAwarenessCount: number
  activeMemberCount: number | null
  unassignedOpenTaskCount: number | null
  myTasks: MyTask[]
  unassignedTasks: DashboardTask[]
  upcomingTasks: DashboardTask[]
  overdueTasks: DashboardTask[]
  recentEvents: DashboardEvent[]
  responsibilities: DashboardResponsibility[]
  weeklyResponsibilities: DashboardResponsibility[]
}

interface NotificationItem {
  id: string
  eventId: string | null
  taskId: string | null
  title: string
  body: string
  readAt: string | null
  createdAt: string
  metadata: Record<string, unknown>
}

interface AiStatusResponse {
  success: boolean
  enabled?: boolean
  configured?: boolean
  pilotScope?: string
  error?: string
}

interface AiHomeSummaryResponse {
  success: boolean
  output?: AiHomeSummary
  generatedAt?: string
  warning?: string
  error?: string
}

async function getAiFunctionErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (!error || typeof error !== 'object' || !('context' in error)) return fallback
  const context = (error as { context?: unknown }).context
  if (!(context instanceof Response)) return fallback
  try {
    const payload = await context.clone().json() as { error?: unknown }
    return typeof payload.error === 'string' && payload.error.trim() ? payload.error : fallback
  } catch {
    return fallback
  }
}

const ASSIGNMENT_TYPE_LABELS: Record<string, string> = {
  primary: 'Ana sorumlu',
  supporting: 'Destekleyen',
  informed: 'Bilgilendirilen',
}

function formatShortDate(value: string | null): string {
  if (!value) return 'Tarih belirtilmedi'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Tarih belirtilmedi'
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateTimeShort(value: string | null): string {
  if (!value) return 'Son tarih yok'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Son tarih yok'
  return date.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatNotificationTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getTaskStatusTone(slug: string | null): TaskStatusTone {
  if (slug === 'completed') return 'success'
  if (slug === 'in_progress') return 'warning'
  if (slug === 'blocked' || slug === 'overdue') return 'danger'
  if (slug === 'cancelled') return 'neutral'
  return 'neutral'
}

function getTaskHref(task: DashboardTask): string {
  return task.eventId ? `/app/etkinlikler/${task.eventId}` : '/app/gorevler'
}

function isInCurrentWeek(value: string | null, now: Date): boolean {
  if (!value) return false
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false

  const weekStart = new Date(now)
  const dayFromMonday = (weekStart.getDay() + 6) % 7
  weekStart.setDate(weekStart.getDate() - dayFromMonday)
  weekStart.setHours(0, 0, 0, 0)

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)
  return date >= weekStart && date < weekEnd
}

function toTaskViewItem(task: DashboardTask, overdue = false): DashboardTaskViewItem {
  return {
    id: task.id,
    title: task.title,
    to: getTaskHref(task),
    context: task.eventTitle,
    deadlineLabel: formatDateTimeShort(task.deadlineAt),
    statusLabel: overdue ? 'Gecikti' : (task.progressStatusLabel ?? 'Durum yok'),
    statusTone: overdue ? 'danger' : getTaskStatusTone(task.progressStatusSlug),
    responsibilityLabel: task.assignmentLabel,
  }
}

function toWeeklyAgendaItem(item: DashboardResponsibility): WeeklyAgendaItem {
  const date = item.date ? new Date(item.date) : null
  const validDate = date && !Number.isNaN(date.getTime()) ? date : null
  const hasTime = Boolean(item.date?.includes('T')) && validDate
    ? validDate.getHours() !== 0 || validDate.getMinutes() !== 0
    : false

  return {
    id: `${item.kind}-${item.id}`,
    dateLabel: validDate
      ? validDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
      : 'Tarih yok',
    dayLabel: validDate ? validDate.toLocaleDateString('tr-TR', { weekday: 'short' }) : undefined,
    title: item.title,
    timeLabel: validDate && hasTime
      ? validDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
      : undefined,
    kind: item.kind,
    to: item.href,
  }
}

export default function AppHome({ session }: { session: Session }) {
  const navigate = useNavigate()
  const { displayName, hasActiveMembership, periodLabel, periodId, profileId, appRole, coordinatorRoleName, coordinatorRoleSlug, loading: membershipLoading } = useMembershipStatus(session)
  const [dataLoading, setDataLoading] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notificationsError, setNotificationsError] = useState<string | null>(null)
  const [notificationsRefreshKey, setNotificationsRefreshKey] = useState(0)
  const [markingReadId, setMarkingReadId] = useState<string | null>(null)
  const [markingAllRead, setMarkingAllRead] = useState(false)
  const [aiEnabled, setAiEnabled] = useState(false)
  const [aiSummary, setAiSummary] = useState<AiHomeSummary | null>(null)
  const [aiClubSummary, setAiClubSummary] = useState<AiHomeSummary | null>(null)
  const [aiGeneratedAt, setAiGeneratedAt] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiWarning, setAiWarning] = useState<string | null>(null)
  const [aiRefreshKey, setAiRefreshKey] = useState(0)

  useEffect(() => {
    if (membershipLoading || !hasActiveMembership) {
      setAiEnabled(false)
      return
    }

    let isMounted = true
    async function loadAiPilot() {
      const { data: statusData, error: statusError } = await supabase.functions.invoke<AiStatusResponse>(
        'ai-orchestrator',
        { body: { operation: 'status' } },
      )
      if (!isMounted) return
      const enabled = !statusError
        && statusData?.success === true
        && statusData.enabled === true
        && statusData.configured === true
        && statusData.pilotScope === 'all_active_members'
      setAiEnabled(enabled)
      if (!enabled) return

      setAiLoading(true)
      setAiError(null)
      const { data: summaryData, error: summaryError } = await supabase.functions.invoke<AiHomeSummaryResponse>(
        'ai-orchestrator',
        { body: { operation: 'home_summary' } },
      )
      if (!isMounted) return
      setAiLoading(false)
      if (summaryError || summaryData?.success !== true || !summaryData.output) {
        const fallback = 'AI özeti şu anda hazırlanamadı. Mevcut ana sayfa verileri kullanılmaya devam ediyor.'
        setAiError(summaryData?.error ?? await getAiFunctionErrorMessage(summaryError, fallback))
        return
      }
      setAiSummary(summaryData.output)
      if (appRole !== 'super_admin' && periodId) {
        const { data: clubDigest } = await supabase.rpc('get_my_safe_ai_club_digest', { target_period_id: periodId })
        if (isMounted) setAiClubSummary(clubDigest && typeof clubDigest === 'object' ? clubDigest as unknown as AiHomeSummary : null)
      } else {
        setAiClubSummary(null)
      }
      setAiGeneratedAt(summaryData.generatedAt ?? null)
      setAiWarning(summaryData.warning ?? null)
    }

    void loadAiPilot()
    return () => { isMounted = false }
  }, [aiRefreshKey, appRole, hasActiveMembership, membershipLoading, periodId])

  useEffect(() => {
    if (!aiEnabled) return
    const refreshTimer = window.setInterval(() => {
      setAiRefreshKey((value) => value + 1)
    }, 5 * 60 * 1000)
    return () => window.clearInterval(refreshTimer)
  }, [aiEnabled])

  useEffect(() => {
    if (membershipLoading || !hasActiveMembership || !periodId) return
    if (appRole !== 'super_admin' && coordinatorRoleSlug !== 'public-relations-coordinator') return
    void supabase.functions.invoke('ai-orchestrator', { body: { operation: 'awareness_suggestion' } })
  }, [appRole, coordinatorRoleSlug, hasActiveMembership, membershipLoading, periodId])

  useEffect(() => {
    if (membershipLoading || !hasActiveMembership || !periodId || !profileId) return

    let isMounted = true
    async function loadDashboard() {
      setDataLoading(true)
      setDataError(null)

      const [{ data: statusRows, error: statusError }, { data: eventStatusRows, error: eventStatusError }] = await Promise.all([
        supabase.from('task_progress_statuses').select('slug, label'),
        supabase.from('event_statuses').select('slug, label'),
      ])

      if (!isMounted) return
      if (statusError || eventStatusError) {
        setDataError('Durum bilgileri yüklenirken bir hata oluştu.')
        setDataLoading(false)
        return
      }

      const statusMap: Record<string, string> = {}
      for (const row of statusRows ?? []) statusMap[row.slug as string] = row.label as string
      const eventStatusMap: Record<string, string> = {}
      for (const row of eventStatusRows ?? []) eventStatusMap[row.slug as string] = row.label as string

      const { data: eventRows, error: eventsError } = await supabase
        .from('events')
        .select('id, title, estimated_date, confirmed_date, event_status, owner_id, created_at')
        .eq('period_id', periodId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      if (!isMounted) return
      if (eventsError) {
        setDataError('Etkinlik verileri yüklenirken bir hata oluştu.')
        setDataLoading(false)
        return
      }

      const events: DashboardEvent[] = (eventRows ?? []).map(row => ({
        id: row.id as string,
        title: row.title as string,
        effectiveDate: ((row.confirmed_date as string | null) ?? (row.estimated_date as string | null)) ?? null,
        eventStatus: row.event_status ? (eventStatusMap[row.event_status as string] ?? row.event_status as string) : null,
        ownerId: row.owner_id as string,
        createdAt: row.created_at as string,
      }))
      const eventTitleMap = Object.fromEntries(events.map(event => [event.id, event.title]))

      const { data: awarenessRows, error: awarenessError } = await supabase
        .from('awareness_posts')
        .select('id, awareness_name, share_date, estimated_date, start_date, created_by, design_responsible_id, press_publication_responsible_id')
        .eq('period_id', periodId)
        .is('deleted_at', null)

      if (!isMounted) return
      if (awarenessError) {
        setDataError('Farkındalık verileri yüklenirken bir hata oluştu.')
        setDataLoading(false)
        return
      }

      const awareness: DashboardAwareness[] = (awarenessRows ?? []).map(row => ({
        id: row.id as string,
        title: row.awareness_name as string,
        shareDate: (row.share_date as string | null) ?? null,
        estimatedDate: (row.estimated_date as string | null) ?? null,
        startDate: (row.start_date as string | null) ?? null,
        createdBy: row.created_by as string,
        designResponsibleId: (row.design_responsible_id as string | null) ?? null,
        pressResponsibleId: (row.press_publication_responsible_id as string | null) ?? null,
      }))

      const { data: manualRows, error: manualError } = await supabase
        .from('calendar_entries')
        .select('id, title, start_date, end_date')
        .eq('period_id', periodId)
        .is('deleted_at', null)
        .order('start_date', { ascending: true })

      if (!isMounted) return
      if (manualError) {
        setDataError('Manuel takvim kayıtları yüklenirken bir hata oluştu.')
        setDataLoading(false)
        return
      }

      let allTasks: DashboardTask[] = []

      const { data: taskRows, error: tasksError } = await supabase
        .from('tasks')
        .select('id, event_id, awareness_post_id, title, progress_status, deadline_at')
        .eq('period_id', periodId)
        .is('deleted_at', null)

      if (!isMounted) return
      if (tasksError) {
        setDataError('Görev verileri yüklenirken bir hata oluştu.')
        setDataLoading(false)
        return
      }

      const awarenessTitleMap: Record<string, string> = {}
      for (const row of awareness) awarenessTitleMap[row.id] = row.title

      allTasks = (taskRows ?? []).map(row => ({
        id: row.id as string,
        eventId: (row.event_id as string | null) ?? null,
        eventTitle: row.event_id
          ? eventTitleMap[row.event_id as string] ?? 'Bilinmeyen Etkinlik'
          : row.awareness_post_id
            ? awarenessTitleMap[row.awareness_post_id as string] ?? 'Farkındalık'
            : 'Bağımsız görev',
        title: row.title as string,
        deadlineAt: (row.deadline_at as string | null) ?? null,
        progressStatusSlug: (row.progress_status as string | null) ?? null,
        progressStatusLabel: row.progress_status ? (statusMap[row.progress_status as string] ?? row.progress_status as string) : 'Durum Yok',
      }))

      const taskIds = allTasks.map(task => task.id)
      let allAssignments: DashboardAssignment[] = []
      if (taskIds.length > 0) {
        const { data: assignmentRows, error: assignError } = await supabase
          .from('task_assignees')
          .select('task_id, profile_id, assignment_type')
          .in('task_id', taskIds)

        if (!isMounted) return
        if (assignError) {
          setDataError('Görev atamaları yüklenirken bir hata oluştu.')
          setDataLoading(false)
          return
        }
        allAssignments = (assignmentRows ?? []) as DashboardAssignment[]
      }

      const now = new Date()
      const isOpen = (task: DashboardTask) => task.progressStatusSlug !== 'completed' && task.progressStatusSlug !== 'cancelled'
      const openTasks = allTasks.filter(isOpen)
      const overdueTasksRaw = openTasks.filter(task => task.deadlineAt && new Date(task.deadlineAt) < now)
      const upcomingTasksRaw = openTasks.filter(task => task.deadlineAt && new Date(task.deadlineAt) >= now)
      overdueTasksRaw.sort((a, b) => new Date(a.deadlineAt!).getTime() - new Date(b.deadlineAt!).getTime())
      upcomingTasksRaw.sort((a, b) => new Date(a.deadlineAt!).getTime() - new Date(b.deadlineAt!).getTime())

      const myAssignmentsMap: Record<string, string> = {}
      for (const row of allAssignments) {
        if (row.profile_id === profileId) myAssignmentsMap[row.task_id] = row.assignment_type
      }

      const myTasks: MyTask[] = []
      let myOpenTaskCount = 0
      for (const task of allTasks) {
        const assignmentType = myAssignmentsMap[task.id]
        if (!assignmentType) continue
        myTasks.push({ ...task, assignmentType, assignmentLabel: ASSIGNMENT_TYPE_LABELS[assignmentType] ?? assignmentType })
        if (isOpen(task)) myOpenTaskCount++
      }

      myTasks.sort((a, b) => {
        const aClosed = isOpen(a) ? 0 : 1
        const bClosed = isOpen(b) ? 0 : 1
        if (aClosed !== bClosed) return aClosed - bClosed
        if (a.deadlineAt && b.deadlineAt) return new Date(a.deadlineAt).getTime() - new Date(b.deadlineAt).getTime()
        if (a.deadlineAt) return -1
        if (b.deadlineAt) return 1
        return 0
      })

      const managedEvents = events.filter(event => event.ownerId === profileId)
      const managedAwareness = awareness.filter(post => post.createdBy === profileId || post.designResponsibleId === profileId || post.pressResponsibleId === profileId)
      const allResponsibilities: DashboardResponsibility[] = [
        ...events.map(event => ({
          id: event.id,
          title: event.title,
          kind: 'event' as const,
          kindLabel: 'Etkinlik',
          date: event.effectiveDate,
          href: `/app/etkinlikler/${event.id}`,
        })),
        ...awareness.map(post => ({
          id: post.id,
          title: post.title,
          kind: 'awareness' as const,
          kindLabel: 'Farkındalık',
          date: post.shareDate ?? post.estimatedDate ?? post.startDate,
          href: '/app/farkindalik',
        })),
        ...(manualRows ?? []).map(entry => ({
          id: entry.id as string,
          title: entry.title as string,
          kind: 'manual' as const,
          kindLabel: 'Manuel takvim kaydı',
          date: (entry.start_date as string | null) ?? null,
          href: `/app/takvim?date=${encodeURIComponent(entry.start_date as string)}`,
        })),
      ]

      const managedEventIds = new Set(managedEvents.map(event => event.id))
      const managedAwarenessIds = new Set(managedAwareness.map(post => post.id))
      const relevantResponsibilities = appRole === 'super_admin'
        ? allResponsibilities
        : allResponsibilities
            .filter(item => item.kind === 'manual'
              || (item.kind === 'event' ? managedEventIds.has(item.id) : managedAwarenessIds.has(item.id)))
            .map(item => ({
              ...item,
              kindLabel: item.kind === 'manual'
                ? 'Manuel takvim kaydı'
                : item.kind === 'event'
                  ? 'Sorumlu olduğun etkinlik'
                  : 'Sorumlu olduğun farkındalık',
            }))

      relevantResponsibilities.sort((a, b) => {
        if (!a.date && !b.date) return 0
        if (!a.date) return 1
        if (!b.date) return -1
        return new Date(a.date).getTime() - new Date(b.date).getTime()
      })

      const todayStart = new Date(now)
      todayStart.setHours(0, 0, 0, 0)
      const futureResponsibilities = relevantResponsibilities.filter(item => {
        if (!item.date) return false
        const date = new Date(item.date)
        return !Number.isNaN(date.getTime()) && date >= todayStart
      })
      const weeklyResponsibilities = futureResponsibilities.filter(item => isInCurrentWeek(item.date, now))
      const upcomingResponsibilities = futureResponsibilities.filter(item => !isInCurrentWeek(item.date, now))

      const myOverdueTasks = myTasks.filter(task => isOpen(task) && task.deadlineAt && new Date(task.deadlineAt) < now)
      const myUpcomingTasks = myTasks.filter(task => isOpen(task) && task.deadlineAt && new Date(task.deadlineAt) >= now)
      myUpcomingTasks.sort((a, b) => new Date(a.deadlineAt!).getTime() - new Date(b.deadlineAt!).getTime())
      const assignedTaskIds = new Set(allAssignments.map(row => row.task_id))
      const overdueTaskIds = new Set(overdueTasksRaw.map(task => task.id))
      const unassignedOpenTasks = openTasks
        .filter(task => !assignedTaskIds.has(task.id) && !overdueTaskIds.has(task.id))
        .sort((a, b) => {
          if (!a.deadlineAt && !b.deadlineAt) return 0
          if (!a.deadlineAt) return 1
          if (!b.deadlineAt) return -1
          return new Date(a.deadlineAt).getTime() - new Date(b.deadlineAt).getTime()
        })
      const unassignedOpenTaskCount = openTasks.filter(task => !assignedTaskIds.has(task.id)).length
      const assignedUpcomingTasks = upcomingTasksRaw.filter(task => assignedTaskIds.has(task.id))
      let activeMemberCount: number | null = null
      if (appRole === 'super_admin') {
        const { count, error: membersError } = await supabase
          .from('period_memberships')
          .select('id', { count: 'exact', head: true })
          .eq('period_id', periodId)
          .eq('is_active', true)
        if (!isMounted) return
        if (membersError) {
          setDataError('Ekip özeti yüklenirken bir hata oluştu.')
          setDataLoading(false)
          return
        }
        activeMemberCount = count ?? 0
      }

      if (!isMounted) return
      setDashboardData({
        activeEventCount: events.length,
        openTaskCount: openTasks.length,
        myOpenTaskCount,
        overdueTaskCount: appRole === 'super_admin' ? overdueTasksRaw.length : myOverdueTasks.length,
        myOverdueTaskCount: myOverdueTasks.length,
        managedEventCount: managedEvents.length,
        managedAwarenessCount: managedAwareness.length,
        activeMemberCount,
        unassignedOpenTaskCount: appRole === 'super_admin' ? unassignedOpenTaskCount : null,
        myTasks: myTasks.filter(task => isOpen(task) && !overdueTaskIds.has(task.id)).slice(0, 5),
        unassignedTasks: appRole === 'super_admin' ? unassignedOpenTasks.slice(0, 5) : [],
        upcomingTasks: (appRole === 'super_admin' ? assignedUpcomingTasks : myUpcomingTasks).slice(0, 5),
        overdueTasks: (appRole === 'super_admin' ? overdueTasksRaw : myOverdueTasks).slice(0, 5),
        recentEvents: events.slice(0, 5),
        responsibilities: upcomingResponsibilities.slice(0, 6),
        weeklyResponsibilities: weeklyResponsibilities.slice(0, 6),
      })
      setDataLoading(false)
    }

    void loadDashboard()
    return () => { isMounted = false }
  }, [appRole, hasActiveMembership, periodId, profileId, membershipLoading])

  useEffect(() => {
    if (membershipLoading || !hasActiveMembership || !profileId) return

    let isMounted = true
    async function loadNotifications() {
      setNotificationsLoading(true)
      setNotificationsError(null)

      const { data, error } = await supabase
        .from('notifications')
        .select('id, event_id, task_id, title, body, read_at, created_at, metadata')
        .eq('recipient_id', profileId)
        .eq('channel', 'in_app')
        .or(`scheduled_for.is.null,scheduled_for.lte.${new Date().toISOString()}`)
        .order('created_at', { ascending: false })
        .limit(20)

      if (!isMounted) return
      if (error) {
        setNotificationsError('Bildirimler yüklenirken bir hata oluştu.')
        setNotificationsLoading(false)
        return
      }

      setNotifications((data ?? []).map(row => ({
        id: row.id as string,
        eventId: (row.event_id as string | null) ?? null,
        taskId: (row.task_id as string | null) ?? null,
        title: row.title as string,
        body: row.body as string,
        readAt: (row.read_at as string | null) ?? null,
        createdAt: row.created_at as string,
        metadata: (row.metadata && typeof row.metadata === 'object' ? row.metadata : {}) as Record<string, unknown>,
      })))
      setNotificationsLoading(false)
    }

    void loadNotifications()
    return () => { isMounted = false }
  }, [hasActiveMembership, membershipLoading, notificationsRefreshKey, profileId])

  useEffect(() => {
    if (membershipLoading || !hasActiveMembership || appRole !== 'super_admin' || !periodId) return
    void supabase.functions.invoke('ai-orchestrator', {
      body: { operation: 'calendar_classification' },
    })
  }, [appRole, hasActiveMembership, membershipLoading, periodId])

  async function handleNotificationClick(notification: NotificationItem) {
    if (!notification.readAt) {
      setMarkingReadId(notification.id)
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notification.id)
        .eq('recipient_id', profileId)

      setMarkingReadId(null)
      if (error) {
        setNotificationsError('Bildirim okundu olarak işaretlenemedi.')
      } else {
        setNotificationsRefreshKey(previous => previous + 1)
      }
    }

    if (notification.eventId) {
      navigate(`/app/etkinlikler/${notification.eventId}`)
      return
    }

    const targetUrl = typeof notification.metadata.url === 'string' ? notification.metadata.url : null
    if (targetUrl?.startsWith('/app/')) {
      navigate(targetUrl)
      return
    }

    if (notification.taskId) {
      const { data, error } = await supabase
        .from('tasks')
        .select('event_id')
        .eq('id', notification.taskId)
        .maybeSingle()

      if (!error && data?.event_id) {
        navigate(`/app/etkinlikler/${data.event_id as string}`)
      } else if (!error) {
        navigate('/app/gorevler')
      }
    }
  }

  async function handleMarkAllAsRead() {
    if (markingAllRead || !profileId) return
    const unreadIds = notifications.filter(notification => !notification.readAt).map(notification => notification.id)
    if (unreadIds.length === 0) return

    setMarkingAllRead(true)
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_id', profileId)
      .eq('channel', 'in_app')
      .or(`scheduled_for.is.null,scheduled_for.lte.${new Date().toISOString()}`)
      .is('read_at', null)
      .in('id', unreadIds)

    setMarkingAllRead(false)
    if (error) {
      setNotificationsError('Bildirimler okundu olarak işaretlenemedi.')
      return
    }
    setNotificationsRefreshKey(previous => previous + 1)
  }

  async function handleRefreshAiSummary() {
    if (!aiEnabled || aiLoading || appRole !== 'super_admin') return
    setAiLoading(true)
    setAiError(null)
    setAiWarning(null)
    const { data: summaryData, error: summaryError } = await supabase.functions.invoke<AiHomeSummaryResponse>(
      'ai-orchestrator',
      { body: { operation: 'home_summary', force: true } },
    )
    setAiLoading(false)
    if (summaryError || summaryData?.success !== true || !summaryData.output) {
      const fallback = 'AI özeti şu anda yenilenemedi. Son geçerli özet korunuyor.'
      setAiError(summaryData?.error ?? await getAiFunctionErrorMessage(summaryError, fallback))
      return
    }
    setAiSummary(summaryData.output)
    setAiGeneratedAt(summaryData.generatedAt ?? null)
    setAiWarning(summaryData.warning ?? null)
  }

  async function handleSignOut() { await supabase.auth.signOut() }

  const roleLabel = coordinatorRoleName ?? (appRole === 'super_admin' ? 'Süper Yönetici' : 'Koordinatör')
  const notificationItems: DashboardNotificationViewItem[] = notifications.map(notification => ({
    id: notification.id,
    title: notification.title,
    body: notification.body,
    timeLabel: formatNotificationTime(notification.createdAt),
    isUnread: !notification.readAt,
    isBusy: markingReadId === notification.id,
  }))
  const activityItems: DashboardActivityViewItem[] = (dashboardData?.recentEvents ?? []).map(event => ({
    id: event.id,
    title: event.title,
    detail: event.eventStatus ?? 'Durum belirtilmedi',
    timeLabel: formatNotificationTime(event.createdAt),
    kind: 'event',
    to: `/app/etkinlikler/${event.id}`,
  }))
  const weeklyAgendaItems = (dashboardData?.weeklyResponsibilities ?? []).map(toWeeklyAgendaItem)

  function handleNotificationById(notificationId: string) {
    const notification = notifications.find(item => item.id === notificationId)
    if (notification) void handleNotificationClick(notification)
  }

  function renderDashboard() {
    if (membershipLoading) {
      return <p className="mx-auto max-w-7xl px-4 py-8 text-sm text-ink-soft sm:px-6 lg:px-8">Yükleniyor…</p>
    }

    if (!hasActiveMembership) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          <div className="rounded-xl border border-accent/30 bg-accent-soft p-4 shadow-card sm:p-6">
            <p className="text-sm font-medium text-ink">Hesabın açık, ancak aktif dönem yetkin henüz tanımlanmamış.</p>
            <p className="mt-2 text-sm text-ink-soft">
              Yönetim kurulu tarafından bu dönem için bir role atanman gerekiyor. Soruların için Bilişim
              Teknolojileri Koordinatörlüğü ile iletişime geç.
            </p>
          </div>
        </div>
      )
    }

    if (dataError) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {dataError}
          </p>
        </div>
      )
    }

    if (dataLoading || !dashboardData) {
      return <p className="mx-auto max-w-7xl px-4 py-8 text-sm text-ink-soft sm:px-6 lg:px-8">Özet bilgileri yükleniyor…</p>
    }

    if (appRole === 'super_admin') {
      return (
        <SuperAdminDashboardView
          displayName={displayName}
          periodLabel={periodLabel}
          activeMemberCount={dashboardData.activeMemberCount ?? 0}
          openTaskCount={dashboardData.openTaskCount}
          unassignedOpenTaskCount={dashboardData.unassignedOpenTaskCount ?? 0}
          overdueTaskCount={dashboardData.overdueTaskCount}
          overdueTasks={dashboardData.overdueTasks.map(task => toTaskViewItem(task, true))}
          unassignedOpenTasks={dashboardData.unassignedTasks.map(task => toTaskViewItem(task))}
          upcomingTeamResponsibilities={dashboardData.upcomingTasks.map(task => toTaskViewItem(task))}
          weeklyAgendaItems={weeklyAgendaItems}
          notifications={notificationItems}
          activities={activityItems}
          notificationsLoading={notificationsLoading}
          notificationsError={notificationsError}
          markingAllRead={markingAllRead}
          onNotificationClick={handleNotificationById}
          onMarkAllNotificationsRead={() => { void handleMarkAllAsRead() }}
          aiSummary={aiSummary}
          aiGeneratedAt={aiGeneratedAt}
          aiLoading={aiLoading}
          aiError={aiError}
          aiWarning={aiWarning}
          onRefreshAiSummary={aiEnabled ? () => { void handleRefreshAiSummary() } : undefined}
        />
      )
    }

    const responsibilityItems: DashboardResponsibilityViewItem[] = dashboardData.responsibilities.map(item => ({
      id: `${item.kind}-${item.id}`,
      title: item.title,
      to: item.href,
      kindLabel: item.kindLabel,
      dateLabel: formatShortDate(item.date),
    }))
    const personalSummaryItems = aiSummary?.items.filter((item) => item.source_type !== 'calendar_entry') ?? []
    const normalAiSummary: AiHomeSummary | null = personalSummaryItems.length > 0
      ? {
          intro: aiSummary?.intro ?? 'Bugün senin için öne çıkan konular var.',
          items: personalSummaryItems,
          club_summary: aiClubSummary,
        }
      : aiClubSummary ?? aiSummary

    return (
      <NormalDashboardView
        displayName={displayName}
        roleLabel={roleLabel}
        periodLabel={periodLabel}
        managedEventCount={dashboardData.managedEventCount}
        managedAwarenessCount={dashboardData.managedAwarenessCount}
        overdueTaskCount={dashboardData.myOverdueTaskCount}
        overdueTasks={dashboardData.overdueTasks.map(task => toTaskViewItem(task, true))}
        weeklyAgendaItems={weeklyAgendaItems}
        responsibilities={responsibilityItems}
        assignedTasks={dashboardData.myTasks.map(task => toTaskViewItem(task))}
        notifications={notificationItems}
        activities={activityItems}
        notificationsLoading={notificationsLoading}
        notificationsError={notificationsError}
        markingAllRead={markingAllRead}
        onNotificationClick={handleNotificationById}
        onMarkAllNotificationsRead={() => { void handleMarkAllAsRead() }}
        aiSummary={normalAiSummary}
        aiGeneratedAt={aiGeneratedAt}
        aiLoading={aiLoading}
        aiError={aiError}
        aiWarning={aiWarning}
        aiAudienceLabel={personalSummaryItems.length > 0 ? 'AI · Sana özel' : 'AI · Kulüp özeti'}
      />
    )
  }

  return (
    <AppShell
      isSuperAdmin={appRole === 'super_admin'}
      displayName={displayName}
      roleLabel={roleLabel}
      onSignOut={handleSignOut}
    >
      <main>{renderDashboard()}</main>
    </AppShell>
  )
}
