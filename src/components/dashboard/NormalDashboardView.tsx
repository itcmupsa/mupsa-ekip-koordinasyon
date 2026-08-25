import { useState, type ReactElement } from 'react'
import { Link } from 'react-router-dom'
import DashboardMetricCard from './DashboardMetricCard'
import DashboardSection from './DashboardSection'
import DashboardEmptyState from './DashboardEmptyState'
import DashboardTaskRow from './DashboardTaskRow'
import WeeklyAgendaCard, { type WeeklyAgendaItem } from './WeeklyAgendaCard'
import AiHomeSummaryCard, { type AiHomeSummary } from './AiHomeSummaryCard'
import type { TaskStatusTone } from '../TaskStatusBadge'

export interface DashboardTaskViewItem {
  id: string
  title: string
  to: string
  context?: string
  deadlineLabel?: string
  statusLabel?: string
  statusTone?: TaskStatusTone
  responsibilityLabel?: string
}

export interface DashboardResponsibilityViewItem {
  id: string
  title: string
  to: string
  kindLabel: string
  dateLabel: string
}

export type DashboardActivityKind = 'event' | 'awareness' | 'task' | 'sks'

export interface DashboardActivityViewItem {
  id: string
  title: string
  detail?: string
  timeLabel: string
  kind: DashboardActivityKind
  to?: string
}

export interface DashboardNotificationViewItem {
  id: string
  title: string
  body: string
  timeLabel: string
  isUnread: boolean
  isBusy?: boolean
}

interface NormalDashboardViewProps {
  displayName: string
  roleLabel: string
  periodLabel?: string | null

  managedEventCount: number
  managedAwarenessCount: number
  overdueTaskCount: number

  overdueTasks: DashboardTaskViewItem[]
  weeklyAgendaItems: WeeklyAgendaItem[]
  responsibilities: DashboardResponsibilityViewItem[]
  assignedTasks: DashboardTaskViewItem[]
  notifications: DashboardNotificationViewItem[]
  activities: DashboardActivityViewItem[]

  notificationsLoading?: boolean
  notificationsError?: string | null
  markingAllRead?: boolean
  onNotificationClick: (notificationId: string) => void
  onMarkAllNotificationsRead: () => void
  aiSummary?: AiHomeSummary | null
  aiGeneratedAt?: string | null
  aiLoading?: boolean
  aiError?: string | null
  aiWarning?: string | null
  aiAudienceLabel?: string
}

function EventDotIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="16" rx="2" />
      <path d="M3.5 9.5h17" />
      <path d="M8 3v3M16 3v3" />
    </svg>
  )
}

function AwarenessDotIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d="M4 10v3a1 1 0 0 0 1 1h2l4.5 3.5v-11L7 10H5a1 1 0 0 0-1 1z" />
      <path d="M16.5 9a4 4 0 0 1 0 6" />
    </svg>
  )
}

function TaskDotIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <rect x="5" y="3.5" width="14" height="17" rx="2" />
      <path d="M8.5 11.5 10.5 13.5 15 9" />
    </svg>
  )
}

function SksDotIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d="M12 3.5l7.5 3.5v4c0 4.5-3.1 8-7.5 9.5-4.4-1.5-7.5-5-7.5-9.5V7z" />
    </svg>
  )
}

const activityIcons: Record<DashboardActivityKind, () => ReactElement> = {
  event: EventDotIcon,
  awareness: AwarenessDotIcon,
  task: TaskDotIcon,
  sks: SksDotIcon,
}

const activityToneClasses: Record<DashboardActivityKind, { bg: string; text: string }> = {
  event: { bg: 'bg-brand-soft', text: 'text-brand-dark' },
  awareness: { bg: 'bg-accent-soft', text: 'text-amber-800' },
  task: { bg: 'bg-sky-100', text: 'text-sky-700' },
  sks: { bg: 'bg-violet-100', text: 'text-violet-700' },
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-ink-soft" aria-hidden="true">
      <path d="M9 5l7 7-7 7" />
    </svg>
  )
}

export default function NormalDashboardView({
  displayName,
  roleLabel,
  periodLabel,
  managedEventCount,
  managedAwarenessCount,
  overdueTaskCount,
  overdueTasks,
  weeklyAgendaItems,
  responsibilities,
  assignedTasks,
  notifications,
  activities,
  notificationsLoading = false,
  notificationsError = null,
  markingAllRead = false,
  onNotificationClick,
  onMarkAllNotificationsRead,
  aiSummary = null,
  aiGeneratedAt = null,
  aiLoading = false,
  aiError = null,
  aiWarning = null,
  aiAudienceLabel = 'AI · Günlük',
}: NormalDashboardViewProps) {
  const [showAllNotifications, setShowAllNotifications] = useState(false)

  const unreadCount = notifications.filter((n) => n.isUnread).length
  const visibleNotifications = showAllNotifications ? notifications : notifications.slice(0, 3)

  const summaryCards = (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <DashboardMetricCard
        label="Sorumlu olduğum etkinlik"
        value={managedEventCount}
        icon="event"
        tone="brand"
        className="order-2 col-span-1 sm:order-1"
      />
      <DashboardMetricCard
        label="Sorumlu olduğum farkındalık"
        value={managedAwarenessCount}
        icon="awareness"
        tone="accent"
        className="order-3 col-span-1 sm:order-2"
      />
      <DashboardMetricCard
        label="Geciken görev"
        value={overdueTaskCount}
        icon="overdue"
        tone={overdueTaskCount > 0 ? 'danger' : 'neutral'}
        className="order-1 col-span-2 sm:order-3 sm:col-span-1"
      />
    </div>
  )

  const overdueSection = (
    <DashboardSection
      title="Geciken görevlerim"
      tone="danger"
      countLabel={overdueTaskCount > 0 ? String(overdueTaskCount) : undefined}
    >
      {overdueTasks.length === 0 ? (
        <DashboardEmptyState
          message="Geciken görev bulunmuyor."
          description="Harika! Tüm görevlerin zamanında."
          icon="success"
          tone="success"
          compact
        />
      ) : (
        <ul className="flex flex-col gap-1">
          {overdueTasks.map((task) => (
            <li key={task.id}>
              <DashboardTaskRow
                title={task.title}
                to={task.to}
                context={task.context}
                deadlineLabel={task.deadlineLabel}
                statusLabel={task.statusLabel}
                statusTone={task.statusTone}
                responsibilityLabel={task.responsibilityLabel}
              />
            </li>
          ))}
        </ul>
      )}
    </DashboardSection>
  )

  const weeklyAgendaSection = <WeeklyAgendaCard items={weeklyAgendaItems} />

  const responsibilitiesSection = (
    <DashboardSection title="Yaklaşan sorumluluklarım">
      {responsibilities.length === 0 ? (
        <DashboardEmptyState message="Yaklaşan sorumluluğun bulunmuyor." icon="tasks" tone="neutral" compact />
      ) : (
        <ul className="flex flex-col gap-1">
          {responsibilities.map((item) => (
            <li key={item.id}>
              <Link
                to={item.to}
                className="flex min-h-[48px] items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium text-ink">{item.title}</p>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {item.kindLabel} · {item.dateLabel}
                  </p>
                </div>
                <ChevronIcon />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardSection>
  )

  const assignedTasksSection = (
    <DashboardSection title="Bana atanmış görevler">
      {assignedTasks.length === 0 ? (
        <DashboardEmptyState message="Sana atanmış açık görev bulunmuyor." icon="tasks" tone="neutral" compact />
      ) : (
        <ul className="flex flex-col gap-1">
          {assignedTasks.map((task) => (
            <li key={task.id}>
              <DashboardTaskRow
                title={task.title}
                to={task.to}
                context={task.context}
                deadlineLabel={task.deadlineLabel}
                statusLabel={task.statusLabel}
                statusTone={task.statusTone}
                responsibilityLabel={task.responsibilityLabel}
              />
            </li>
          ))}
        </ul>
      )}
    </DashboardSection>
  )

  const notificationsSection = (
    <DashboardSection
      title="Bildirimler"
      countLabel={unreadCount > 0 ? String(unreadCount) : undefined}
      headerAction={unreadCount > 0 ? (
        <button
          type="button"
          onClick={onMarkAllNotificationsRead}
          disabled={markingAllRead}
          className="shrink-0 rounded-md px-1 py-1 text-xs font-medium text-brand-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:px-2 sm:text-sm"
        >
          {markingAllRead ? 'İşaretleniyor…' : 'Tümünü okundu işaretle'}
        </button>
      ) : undefined}
    >
      {notificationsLoading ? (
        <p className="px-3 py-4 text-sm text-ink-soft">Yükleniyor…</p>
      ) : notificationsError ? (
        <div role="alert" className="rounded-lg bg-danger-soft px-3 py-3 text-sm text-danger">
          {notificationsError}
        </div>
      ) : notifications.length === 0 ? (
        <DashboardEmptyState message="Yeni bildirimin bulunmuyor." icon="notifications" tone="neutral" compact />
      ) : (
        <>
          <ul className="flex flex-col gap-1">
            {visibleNotifications.map((notification) => (
              <li key={notification.id}>
                <button
                  type="button"
                  onClick={() => onNotificationClick(notification.id)}
                  disabled={notification.isBusy}
                  className="flex w-full min-h-[48px] items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {notification.isUnread ? (
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent"
                      aria-hidden="true"
                    />
                  ) : (
                    <span className="mt-1.5 h-2 w-2 shrink-0" aria-hidden="true" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-medium text-ink">{notification.title}</p>
                    <p className="mt-0.5 break-words text-xs text-ink-soft">{notification.body}</p>
                    <p className="mt-1 text-xs text-ink-soft">{notification.timeLabel}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>

          {notifications.length > 3 ? (
            <div className="mt-2 flex justify-center border-t border-canvas-border pt-2">
              <button
                type="button"
                onClick={() => setShowAllNotifications((prev) => !prev)}
                className="rounded-md px-3 py-2 text-sm font-medium text-brand-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                {showAllNotifications ? 'Daha az göster' : 'Tüm bildirimleri görüntüle'}
              </button>
            </div>
          ) : null}
        </>
      )}
    </DashboardSection>
  )

  const activitiesSection = (
    <DashboardSection title="Son hareketler">
      {activities.length === 0 ? (
        <DashboardEmptyState message="Henüz gösterilecek hareket bulunmuyor." icon="activity" tone="neutral" compact />
      ) : (
        <ul className="flex flex-col gap-1">
          {activities.map((activity) => {
            const Icon = activityIcons[activity.kind]
            const colors = activityToneClasses[activity.kind]

            const rowContent = (
              <>
                <span
                  className={[
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                    colors.bg,
                    colors.text,
                  ].join(' ')}
                >
                  <Icon />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium text-ink">{activity.title}</p>
                  {activity.detail ? (
                    <p className="mt-0.5 break-words text-xs text-ink-soft">{activity.detail}</p>
                  ) : null}
                  <p className="mt-0.5 text-xs text-ink-soft">{activity.timeLabel}</p>
                </div>
              </>
            )

            return (
              <li key={activity.id}>
                {activity.to ? (
                  <Link
                    to={activity.to}
                    className="flex min-h-[48px] items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                  >
                    {rowContent}
                    <ChevronIcon />
                  </Link>
                ) : (
                  <div className="flex min-h-[48px] items-center gap-3 px-3 py-2.5">{rowContent}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </DashboardSection>
  )

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-6">
        <p className="text-sm text-ink-soft">Hoş geldin,</p>
        <h1 className="mt-0.5 text-2xl font-semibold text-ink sm:text-3xl">{displayName}</h1>
        <p className="mt-2 text-sm text-ink-soft">Rol: {roleLabel}</p>
        {periodLabel ? (
          <p className="mt-0.5 text-sm text-ink-soft">
            Aktif dönem: <span className="font-medium text-ink">{periodLabel}</span>
          </p>
        ) : null}
      </div>

      {aiSummary || aiLoading || aiError ? (
        <AiHomeSummaryCard
          summary={aiSummary}
          generatedAt={aiGeneratedAt}
          loading={aiLoading}
          error={aiError}
          warning={aiWarning}
          audienceLabel={aiAudienceLabel}
        />
      ) : null}

      <div className="mb-4 lg:mb-6">{summaryCards}</div>

      <div className="flex flex-col gap-4 lg:hidden">
        {overdueSection}
        {weeklyAgendaSection}
        {responsibilitiesSection}
        {assignedTasksSection}
        {notificationsSection}
        {activitiesSection}
      </div>

      <div className="hidden grid-cols-2 items-start gap-6 lg:grid">
        <div className="flex min-w-0 flex-col gap-6">
          {overdueSection}
          {assignedTasksSection}
          {notificationsSection}
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          {responsibilitiesSection}
          {weeklyAgendaSection}
          {activitiesSection}
        </div>
      </div>
    </div>
  )
}
