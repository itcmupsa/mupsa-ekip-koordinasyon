import { buildDeterministicHomeSummary } from '../functions/_shared/mupiPriority.ts'

const SUMMARY_DATE = '2026-08-26'

function dateMinus(days: number): string {
  const date = new Date(`${SUMMARY_DATE}T12:00:00+03:00`)
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString()
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

Deno.test('post-event preparation warnings close and due report can surface', () => {
  const reportDue = buildDeterministicHomeSummary({
    summaryDate: SUMMARY_DATE,
    context: {
      events: [{
        source_id: 'report-due',
        title: 'Completed Event',
        effective_date: dateMinus(5),
        lifecycle_phase: 'report_due',
        report_status: 'no',
        design_announcement_status: 'ready',
        missing_fields: ['venue'],
      }],
    },
  })
  assert(reportDue.today[0]?.reasonCode === 'event_report_due', 'A due report must surface in Today.')

  const reportComplete = buildDeterministicHomeSummary({
    summaryDate: SUMMARY_DATE,
    context: {
      events: [{
        source_id: 'report-complete',
        title: 'Reported Event',
        effective_date: dateMinus(5),
        lifecycle_phase: 'report_due',
        report_status: 'yes',
        design_announcement_status: 'brief_pending',
        missing_fields: ['venue'],
      }],
    },
  })
  assert(reportComplete.today.length === 0 && reportComplete.upcoming.length === 0, 'Completed reports must suppress old preparation warnings.')
})
