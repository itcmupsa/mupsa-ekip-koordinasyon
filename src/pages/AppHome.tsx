import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useMembershipStatus } from '../hooks/useMembershipStatus'

interface DashboardEvent {
  id: string
  title: string
  planningDate: string | null
  eventStatus: string | null
  createdAt: string
}

interface DashboardTask {
  id: string
  eventId: string
  eventTitle: string
  title: string
  deadlineAt: string | null
  progressStatusSlug: string | null
  progressStatusLabel: string | null
}

interface DashboardAssignment {
  task_id: string
  assignment_type: string
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
  myTasks: MyTask[]
  upcomingTasks: DashboardTask[]
  overdueTasks: DashboardTask[]
  recentEvents: DashboardEvent[]
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

export default function AppHome({ session }: { session: Session }) {
  const { displayName, hasActiveMembership, periodLabel, periodId, profileId, appRole, loading: membershipLoading } = useMembershipStatus(session)
  const isSuperAdmin = hasActiveMembership && appRole === 'super_admin'
  const [dataLoading, setDataLoading] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)

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
        .select('id, title, planning_date, event_status, created_at')
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
        planningDate: (row.planning_date as string | null) ?? null,
        eventStatus: row.event_status ? (eventStatusMap[row.event_status as string] ?? row.event_status as string) : null,
        createdAt: row.created_at as string,
      }))
      const eventIds = events.map(event => event.id)
      const eventTitleMap = Object.fromEntries(events.map(event => [event.id, event.title]))

      let allTasks: DashboardTask[] = []
      let myRawAssignments: DashboardAssignment[] = []

      if (eventIds.length > 0) {
        const { data: taskRows, error: tasksError } = await supabase
          .from('tasks')
          .select('id, event_id, title, progress_status, deadline_at')
          .in('event_id', eventIds)
          .is('deleted_at', null)

        if (!isMounted) return
        if (tasksError) {
          setDataError('Görev verileri yüklenirken bir hata oluştu.')
          setDataLoading(false)
          return
        }

        allTasks = (taskRows ?? []).map(row => ({
          id: row.id as string,
          eventId: row.event_id as string,
          eventTitle: eventTitleMap[row.event_id as string] ?? 'Bilinmeyen Etkinlik',
          title: row.title as string,
          deadlineAt: (row.deadline_at as string | null) ?? null,
          progressStatusSlug: (row.progress_status as string | null) ?? null,
          progressStatusLabel: row.progress_status ? (statusMap[row.progress_status as string] ?? row.progress_status as string) : 'Durum Yok',
        }))

        const taskIds = allTasks.map(task => task.id)
        if (taskIds.length > 0) {
          const { data: assignmentRows, error: assignError } = await supabase
            .from('task_assignees')
            .select('task_id, assignment_type')
            .in('task_id', taskIds)
            .eq('profile_id', profileId)

          if (!isMounted) return
          if (assignError) {
            setDataError('Görev atamaları yüklenirken bir hata oluştu.')
            setDataLoading(false)
            return
          }
          myRawAssignments = (assignmentRows ?? []) as DashboardAssignment[]
        }
      }

      const now = new Date()
      const isOpen = (task: DashboardTask) => task.progressStatusSlug !== 'completed' && task.progressStatusSlug !== 'cancelled'
      const openTasks = allTasks.filter(isOpen)
      const overdueTasksRaw = openTasks.filter(task => task.deadlineAt && new Date(task.deadlineAt) < now)
      const upcomingTasksRaw = openTasks.filter(task => task.deadlineAt && new Date(task.deadlineAt) >= now)
      overdueTasksRaw.sort((a, b) => new Date(a.deadlineAt!).getTime() - new Date(b.deadlineAt!).getTime())
      upcomingTasksRaw.sort((a, b) => new Date(a.deadlineAt!).getTime() - new Date(b.deadlineAt!).getTime())

      const myAssignmentsMap: Record<string, string> = {}
      for (const row of myRawAssignments) myAssignmentsMap[row.task_id] = row.assignment_type

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

      if (!isMounted) return
      setDashboardData({
        activeEventCount: events.length,
        openTaskCount: openTasks.length,
        myOpenTaskCount,
        overdueTaskCount: overdueTasksRaw.length,
        myTasks,
        upcomingTasks: upcomingTasksRaw.slice(0, 5),
        overdueTasks: overdueTasksRaw.slice(0, 5),
        recentEvents: events.slice(0, 5),
      })
      setDataLoading(false)
    }

    void loadDashboard()
    return () => { isMounted = false }
  }, [hasActiveMembership, periodId, profileId, membershipLoading])

  async function handleSignOut() { await supabase.auth.signOut() }

  return (
    <div className="min-h-screen bg-canvas pb-12">
      <header className="border-b border-canvas-border bg-canvas-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <span className="text-sm font-semibold text-ink">MUPSA Ekip Koordinasyon</span>
          <button type="button" onClick={handleSignOut} className="text-sm font-medium text-ink-soft hover:text-ink">Çıkış yap</button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        {membershipLoading ? <p className="text-sm text-ink-soft">Yükleniyor…</p> : !hasActiveMembership ? (
          <div className="mt-6 rounded-lg border border-accent/30 bg-accent-soft p-6">
            <p className="text-sm font-medium text-ink">Hesabın açık, ancak aktif dönem yetkin henüz tanımlanmamış.</p>
            <p className="mt-2 text-sm text-ink-soft">Yönetim kurulu tarafından bu dönem için bir role atanman gerekiyor. Soruların için Bilişim Teknolojileri Koordinatörlüğü ile iletişime geç.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            <div>
              <p className="text-sm text-ink-soft">Hoş geldin,</p>
              <h1 className="mt-1 text-2xl font-semibold text-ink">{displayName}</h1>
              <p className="mt-1 text-sm text-ink-soft">{periodLabel ? `Aktif dönem: ${periodLabel}` : 'Aktif Dönem'}</p>
            </div>
            {dataLoading ? <p className="text-sm text-ink-soft">Özet bilgileri yükleniyor…</p> : dataError ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{dataError}</p>
            ) : dashboardData ? (
              <>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="rounded-lg border border-canvas-border bg-canvas-surface p-4 shadow-sm"><p className="text-xs font-medium text-ink-soft">Aktif Etkinlik</p><p className="mt-1 text-2xl font-semibold text-ink">{dashboardData.activeEventCount}</p></div>
                  <div className="rounded-lg border border-canvas-border bg-canvas-surface p-4 shadow-sm"><p className="text-xs font-medium text-ink-soft">Açık Görev</p><p className="mt-1 text-2xl font-semibold text-ink">{dashboardData.openTaskCount}</p></div>
                  <div className="rounded-lg border border-canvas-border bg-canvas-surface p-4 shadow-sm"><p className="text-xs font-medium text-ink-soft">Bana Atanan Açık</p><p className="mt-1 text-2xl font-semibold text-ink">{dashboardData.myOpenTaskCount}</p></div>
                  <div className={`rounded-lg border p-4 shadow-sm ${dashboardData.overdueTaskCount > 0 ? 'border-red-200 bg-red-50' : 'border-canvas-border bg-canvas-surface'}`}><p className={`text-xs font-medium ${dashboardData.overdueTaskCount > 0 ? 'text-red-700' : 'text-ink-soft'}`}>Geciken Görev</p><p className={`mt-1 text-2xl font-semibold ${dashboardData.overdueTaskCount > 0 ? 'text-red-700' : 'text-ink'}`}>{dashboardData.overdueTaskCount}</p></div>
                </div>
                <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                  <div className="flex flex-col gap-8">
                    <section>
                      <h2 className="mb-3 border-b border-canvas-border pb-2 text-sm font-semibold text-ink">Bana Atanmış Görevler</h2>
                      {dashboardData.myTasks.length === 0 ? <p className="text-sm italic text-ink-soft">Size atanmış bir görev bulunmuyor.</p> : <ul className="flex flex-col gap-3">{dashboardData.myTasks.map(task => <li key={task.id} className="rounded-md border border-canvas-border bg-canvas-surface p-3 transition-colors hover:border-ink/20"><Link to={`/app/etkinlikler/${task.eventId}`} className="block rounded-sm focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2"><div className="flex items-start justify-between gap-2"><p className="text-sm font-medium text-ink">{task.title}</p><span className="shrink-0 rounded border border-canvas-border bg-canvas px-2 py-0.5 text-[10px] font-medium text-ink-soft">{task.progressStatusLabel}</span></div><p className="mt-1 truncate text-xs text-ink-soft">{task.eventTitle}</p><div className="mt-2 flex items-center justify-between text-xs text-ink-soft"><span>{formatDateTimeShort(task.deadlineAt)}</span><span className="font-medium">{task.assignmentLabel}</span></div></Link></li>)}</ul>}
                    </section>
                    <section>
                      <h2 className="mb-3 border-b border-canvas-border pb-2 text-sm font-semibold text-ink">Son Etkinlikler</h2>
                      {dashboardData.recentEvents.length === 0 ? <p className="text-sm italic text-ink-soft">Kayıtlı etkinlik bulunmuyor.</p> : <ul className="flex flex-col gap-3">{dashboardData.recentEvents.map(event => <li key={event.id} className="rounded-md border border-canvas-border bg-canvas-surface p-3 transition-colors hover:border-ink/20"><Link to={`/app/etkinlikler/${event.id}`} className="block rounded-sm focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2"><p className="truncate text-sm font-medium text-ink">{event.title}</p><div className="mt-2 flex items-center justify-between text-xs text-ink-soft"><span>{event.eventStatus ?? 'Durum belirtilmedi'}</span><span>{formatShortDate(event.planningDate)}</span></div></Link></li>)}</ul>}
                    </section>
                  </div>
                  <div className="flex flex-col gap-8">
                    <section>
                      <h2 className="mb-3 border-b border-red-200 pb-2 text-sm font-semibold text-red-700">Geciken Görevler</h2>
                      {dashboardData.overdueTasks.length === 0 ? <p className="text-sm italic text-ink-soft">Geciken görev bulunmuyor.</p> : <ul className="flex flex-col gap-3">{dashboardData.overdueTasks.map(task => <li key={task.id} className="rounded-md border border-red-200 bg-red-50 p-3 transition-colors hover:border-red-300"><Link to={`/app/etkinlikler/${task.eventId}`} className="block rounded-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"><p className="text-sm font-medium text-red-900">{task.title}</p><p className="mt-1 truncate text-xs text-red-700/80">{task.eventTitle}</p><div className="mt-2 text-xs font-semibold text-red-700">{formatDateTimeShort(task.deadlineAt)}</div></Link></li>)}</ul>}
                    </section>
                    <section>
                      <h2 className="mb-3 border-b border-canvas-border pb-2 text-sm font-semibold text-ink">Yaklaşan Görevler</h2>
                      {dashboardData.upcomingTasks.length === 0 ? <p className="text-sm italic text-ink-soft">Yaklaşan açık görev bulunmuyor.</p> : <ul className="flex flex-col gap-3">{dashboardData.upcomingTasks.map(task => <li key={task.id} className="rounded-md border border-canvas-border bg-canvas-surface p-3 transition-colors hover:border-ink/20"><Link to={`/app/etkinlikler/${task.eventId}`} className="block rounded-sm focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2"><p className="text-sm font-medium text-ink">{task.title}</p><p className="mt-1 truncate text-xs text-ink-soft">{task.eventTitle}</p><div className="mt-2 text-xs text-ink-soft">{formatDateTimeShort(task.deadlineAt)}</div></Link></li>)}</ul>}
                    </section>
                  </div>
                </div>
                <section className="mt-4 border-t border-canvas-border pt-6"><h2 className="mb-4 text-sm font-semibold text-ink">Hızlı Erişim</h2><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Link to="/app/etkinlikler" className="block rounded-lg border border-canvas-border bg-canvas-surface p-4 shadow-card transition-colors hover:border-ink/30 focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2"><p className="text-sm font-semibold text-ink">Tüm Etkinlikler</p><p className="mt-1 text-xs text-ink-soft">Aktif dönemdeki tüm etkinlikleri ve detaylarını görüntüle.</p></Link>{isSuperAdmin && <Link to="/app/yonetim/uyeler" className="block rounded-lg border border-canvas-border bg-canvas-surface p-4 shadow-card transition-colors hover:border-ink/30 focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2"><p className="text-sm font-semibold text-ink">Ekip ve yetki yönetimi</p><p className="mt-1 text-xs text-ink-soft">Aktif dönemdeki koordinatörleri ve uygulama yetkilerini yönet.</p></Link>}</div></section>
              </>
            ) : null}
          </div>
        )}
      </main>
    </div>
  )
}
