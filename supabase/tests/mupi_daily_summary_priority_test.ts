import { buildDeterministicHomeSummary } from '../functions/_shared/mupiPriority.ts'

const SUMMARY_DATE = '2026-08-26'

function datePlus(days: number): string {
  const date = new Date(`${SUMMARY_DATE}T12:00:00+03:00`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString()
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

Deno.test('tasks: deadline boundary buckets are deterministic', () => {
  const tasks = [-1, 0, 1, 2, 3, 4, 7, 8, 14, 15].map((days, index) => ({
    source_id: `00000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`,
    title: `Task ${days}`,
    deadline_at: datePlus(days),
    progress_status: 'in_progress',
    priority: 'normal',
  }))

  const result = buildDeterministicHomeSummary({ context: { tasks }, summaryDate: SUMMARY_DATE })
  assert(result.today.length === 3, 'Today must be capped at 3 items.')
  assert(result.today[0].reasonCode === 'task_overdue', 'Overdue task must rank first.')
  assert(result.today[1].reasonCode === 'task_due_today', 'Due-today task must rank second.')
  assert(result.today[2].reasonCode === 'task_due_tomorrow', 'Due-tomorrow task must rank before 2-3 day tasks.')
  assert(result.upcoming.length === 3, 'Upcoming must be capped at 3 items.')
  assert(result.upcoming.every((item) => item.bucket === 'upcoming'), 'Upcoming bucket must stay deterministic.')
})

Deno.test('tasks: completed and cancelled items are never candidates', () => {
  const result = buildDeterministicHomeSummary({
    summaryDate: SUMMARY_DATE,
    context: {
      tasks: [
        { source_id: '1', title: 'Completed', deadline_at: datePlus(-5), progress_status: 'completed', priority: 'urgent' },
        { source_id: '2', title: 'Cancelled', deadline_at: datePlus(0), progress_status: 'cancelled', priority: 'urgent' },
      ],
    },
  })
  assert(result.today.length === 0 && result.upcoming.length === 0, 'Closed tasks must not appear.')
})

Deno.test('events: 31-40 days are monitored silently and 30 days can surface only with missing preparation', () => {
  const event = (days: number, design: string, id: string) => ({
    source_id: id,
    title: `Event ${days}`,
    effective_date: datePlus(days),
    design_announcement_status: design,
    missing_fields: [],
  })

  for (const days of [40, 31]) {
    const result = buildDeterministicHomeSummary({ context: { events: [event(days, 'brief_pending', String(days))] }, summaryDate: SUMMARY_DATE })
    assert(result.today.length === 0 && result.upcoming.length === 0, `${days}-day event must stay silent.`)
  }

  const missingAt30 = buildDeterministicHomeSummary({ context: { events: [event(30, 'brief_pending', '30')] }, summaryDate: SUMMARY_DATE })
  assert(missingAt30.upcoming[0]?.reasonCode === 'event_early_preparation', '30-day missing event must surface as early preparation.')

  const readyAt30 = buildDeterministicHomeSummary({ context: { events: [event(30, 'ready', 'ready30')] }, summaryDate: SUMMARY_DATE })
  assert(readyAt30.upcoming.length === 0, 'Ready 30-day event must not create noise.')
})

Deno.test('events: exact phase boundaries behave as designed', () => {
  const boundaries = [22, 21, 15, 14, 8, 7, 3, 2, 1, 0]
  const events = boundaries.map((days) => ({
    source_id: `e${days}`,
    title: `Event ${days}`,
    effective_date: datePlus(days),
    design_announcement_status: 'brief_pending',
    missing_fields: ['venue'],
  }))
  const all = boundaries.map((days) => ({
    days,
    result: buildDeterministicHomeSummary({ context: { events: [events.find((event) => event.source_id === `e${days}`)!] }, summaryDate: SUMMARY_DATE }),
  }))

  assert(all.find((x) => x.days === 22)!.result.upcoming[0]?.reasonCode === 'event_early_preparation', '22 days must be early preparation.')
  assert(all.find((x) => x.days === 21)!.result.upcoming[0]?.reasonCode === 'event_active_preparation_missing', '21 days must be active preparation.')
  assert(all.find((x) => x.days === 15)!.result.upcoming[0]?.reasonCode === 'event_active_preparation_missing', '15 days must be active preparation.')
  assert(all.find((x) => x.days === 14)!.result.upcoming[0]?.reasonCode === 'event_intensive_preparation_missing', '14 days must be intensive preparation.')
  assert(all.find((x) => x.days === 8)!.result.upcoming[0]?.reasonCode === 'event_intensive_preparation_missing', '8 days must be intensive preparation.')
  assert(all.find((x) => x.days === 7)!.result.today[0]?.reasonCode === 'event_final_preparation_missing', '7 days must move to Today when preparation is missing.')
  assert(all.find((x) => x.days === 3)!.result.today[0]?.reasonCode === 'event_final_preparation_missing', '3 days must stay final preparation.')
  assert(all.find((x) => x.days === 2)!.result.today[0]?.reasonCode === 'event_critical_preparation_missing', '2 days must be critical.')
  assert(all.find((x) => x.days === 1)!.result.today[0]?.reasonCode === 'event_critical_preparation_missing', '1 day must be critical.')
  assert(all.find((x) => x.days === 0)!.result.today[0]?.reasonCode === 'event_day', '0 days must be event day.')
})

Deno.test('awareness: shared items are expected to be filtered by context and date priorities are deterministic', () => {
  const result = buildDeterministicHomeSummary({
    summaryDate: SUMMARY_DATE,
    context: {
      awareness: [
        { source_id: 'a1', title: 'Late', effective_date: datePlus(-1) },
        { source_id: 'a2', title: 'Today', effective_date: datePlus(0) },
        { source_id: 'a3', title: 'Soon', effective_date: datePlus(3) },
        { source_id: 'a4', title: 'Upcoming', effective_date: datePlus(10) },
        { source_id: 'a5', title: 'Far', effective_date: datePlus(11) },
      ],
    },
  })
  assert(result.today.map((item) => item.reasonCode).join(',') === 'awareness_share_overdue,awareness_share_today,awareness_final_preparation', 'Awareness Today ordering is incorrect.')
  assert(result.upcoming[0]?.reasonCode === 'awareness_upcoming_preparation', '10-day awareness must be Upcoming.')
})

Deno.test('calendar: today and next seven days are mandatory candidates', () => {
  const result = buildDeterministicHomeSummary({
    summaryDate: SUMMARY_DATE,
    context: {
      calendar: [
        { source_id: 'meeting-today', title: 'MUPSA 2. Online Toplantı', start_date: datePlus(0), entry_type: 'meeting' },
        { source_id: 'meeting-tomorrow', title: 'Yönetim Kurulu Toplantısı', start_date: datePlus(1), entry_type: 'meeting' },
        { source_id: 'meeting-next-week', title: 'Haftalık Toplantı', start_date: datePlus(7), entry_type: 'meeting' },
        { source_id: 'meeting-later', title: 'Uzak Toplantı', start_date: datePlus(8), entry_type: 'meeting' },
      ],
    },
  })

  assert(result.today.some((item) => item.entityId === 'meeting-today' && item.reasonCode === 'calendar_today'), 'Today meeting must appear in Today.')
  assert(result.upcoming.some((item) => item.entityId === 'meeting-tomorrow' && item.reasonCode === 'calendar_upcoming'), 'Tomorrow meeting must appear in Upcoming.')
  assert(result.upcoming.some((item) => item.entityId === 'meeting-next-week' && item.reasonCode === 'calendar_upcoming'), 'Seven-day meeting must appear in Upcoming.')
  assert(![...result.today, ...result.upcoming].some((item) => item.entityId === 'meeting-later'), 'Eight-day calendar entry must stay out of the daily summary.')
})

Deno.test('category urgency beats raw score and each entity appears once', () => {
  const result = buildDeterministicHomeSummary({
    summaryDate: SUMMARY_DATE,
    context: {
      tasks: [
        { source_id: 'same', title: 'Critical task', deadline_at: datePlus(0), progress_status: 'in_progress', priority: 'low' },
        { source_id: 'later', title: 'Later task', deadline_at: datePlus(4), progress_status: 'in_progress', priority: 'urgent' },
      ],
      events: [
        { source_id: 'evt', title: 'Event today', effective_date: datePlus(0), design_announcement_status: 'ready', missing_fields: [] },
      ],
    },
  })
  assert(result.today[0]?.urgency === 'critical', 'Critical category must rank first.')
  const keys = [...result.today, ...result.upcoming].map((item) => `${item.entityType}:${item.entityId}`)
  assert(new Set(keys).size === keys.length, 'An entity must not be duplicated.')
})
