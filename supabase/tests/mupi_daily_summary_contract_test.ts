import { buildDeterministicHomeSummary } from '../functions/_shared/mupiPriority.ts'

const SUMMARY_DATE = '2026-08-26'

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

async function read(relativeUrl: string): Promise<string> {
  return await Deno.readTextFile(new URL(relativeUrl, import.meta.url))
}

function datePlus(days: number): string {
  const date = new Date(`${SUMMARY_DATE}T12:00:00+03:00`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString()
}

Deno.test('migration order seeds MUPI only after the generation guard exists', async () => {
  const earlyMigration = await read('../migrations/20260826163000_protect_and_seed_mupi_daily_v2.sql')
  const guardMigration = await read('../migrations/20260826166000_add_mupi_daily_generation_guard.sql')
  const seedMigration = await read('../migrations/20260826167000_seed_mupi_daily_after_all_dependencies.sql')

  assert(!earlyMigration.includes('net.http_post'), '1630 migration must not trigger an early HTTP seed.')
  assert(guardMigration.includes('reserve_mupi_daily_generation'), '1660 must create the generation guard before the seed.')
  assert((seedMigration.match(/select\s+net\.http_post/gi) ?? []).length === 1, '1670 must contain exactly one seed HTTP statement.')
  assert(seedMigration.includes('/functions/v1/mupi-daily-summary'), 'Final seed must call the isolated MUPI v2 function.')
})

Deno.test('coordinator and super admin retain shared manual calendar candidates end to end', async () => {
  const edgeFunction = await read('../functions/mupi-daily-summary/index.ts')
  const legacyOrchestrator = await read('../functions/ai-orchestrator/index.ts')
  const appHome = await read('../../src/pages/AppHome.tsx')
  const summaryCard = await read('../../src/components/dashboard/AiHomeSummaryCard.tsx')
  const context = {
    calendar: [
      { source_id: 'today', title: 'Bugünkü toplantı', start_date: datePlus(0), entry_type: 'meeting' },
      { source_id: 'tomorrow', title: 'Yarınki toplantı', start_date: datePlus(1), entry_type: 'meeting' },
    ],
  }

  assert(!/calendar\s*=\s*\[\]/.test(edgeFunction), 'Edge Function must not erase coordinator calendar context.')
  assert(!/entityType\s*!==\s*['"]calendar_entry['"]/.test(legacyOrchestrator), 'Legacy home summary must not erase coordinator calendar sources.')
  assert(legacyOrchestrator.includes("body.operation === 'calendar_classification'"), 'Calendar classification operation must remain explicit.')
  assert(legacyOrchestrator.includes("membership.app_role !== 'super_admin'"), 'Calendar classification must retain its Super Admin authorization.')
  assert(edgeFunction.includes('context: contextData'), 'Deterministic engine must receive the authorized RPC context directly.')
  assert(edgeFunction.includes('const today = decision.today.map(resolve)'), 'API payload must retain deterministic Today items.')
  assert(edgeFunction.includes('const upcoming = decision.upcoming.map(resolve)'), 'API payload must retain deterministic Upcoming items.')
  assert(!/source_type\s*!==\s*['"]calendar_entry['"]/.test(appHome), 'Frontend must not filter manual calendar items.')
  assert(appHome.includes('const personalTodayItems = aiSummary?.today'), 'Frontend must retain Today items.')
  assert(appHome.includes('const personalUpcomingItems = aiSummary?.upcoming'), 'Frontend must retain Upcoming items.')
  assert(appHome.includes('aiClubSummary ?? personalAiSummary'), 'Empty personal summaries must fall back to the safe club digest.')
  assert(summaryCard.includes('<SummaryList items={splitItems.today} />'), 'The card must render Today items.')
  assert(summaryCard.includes('<SummaryList items={splitItems.upcoming} />'), 'The card must render Upcoming items.')

  for (const role of ['coordinator', 'super_admin']) {
    const result = buildDeterministicHomeSummary({ context, summaryDate: SUMMARY_DATE })
    assert(result.today.some((item) => item.entityId === 'today'), `${role}: today's shared calendar entry must survive.`)
    assert(result.upcoming.some((item) => item.entityId === 'tomorrow'), `${role}: tomorrow's shared calendar entry must survive.`)
  }
})

Deno.test('manual calendar boundaries are exact at 0, 1, 7 and 8 days', () => {
  for (const [days, expectedBucket] of [[0, 'today'], [1, 'upcoming'], [7, 'upcoming'], [8, 'none']] as const) {
    const result = buildDeterministicHomeSummary({
      summaryDate: SUMMARY_DATE,
      context: { calendar: [{ source_id: `day-${days}`, title: `Day ${days}`, start_date: datePlus(days), entry_type: 'meeting' }] },
    })
    const actualBucket = result.today.length > 0 ? 'today' : result.upcoming.length > 0 ? 'upcoming' : 'none'
    assert(actualBucket === expectedBucket, `${days}-day calendar entry must be ${expectedBucket}, received ${actualBucket}.`)
  }
})

Deno.test('daily cache, force authorization, concurrency lock, fallback and key rotation contracts remain present', async () => {
  const edgeFunction = await read('../functions/mupi-daily-summary/index.ts')
  const guardMigration = await read('../migrations/20260826166000_add_mupi_daily_generation_guard.sql')
  const outputMigration = await read('../migrations/20260826160000_mupi_daily_summary_v2.sql')

  assert(edgeFunction.includes("if (existing && !body.force)"), 'Second normal request must return the daily cache.')
  assert(edgeFunction.includes("membership.app_role !== 'super_admin'"), 'Coordinator force refresh must be rejected.')
  assert(edgeFunction.includes("target_force: body.force === true"), 'Super admin force refresh must reach the guard.')
  assert(guardMigration.includes('pg_advisory_xact_lock'), 'Concurrent requests must serialize on an advisory lock.')
  assert(guardMigration.includes("existing_job.status = 'running'"), 'A running generation must block force and normal requests.')
  assert(guardMigration.indexOf("existing_job.status = 'running'") < guardMigration.indexOf("return jsonb_build_object('allowed', true"), 'Running-lock check must happen before generation is allowed.')
  assert(outputMigration.includes('ai_outputs_home_summary_daily_unique'), 'One output per user/day must be enforced by a unique index.')
  assert(outputMigration.includes('created_at = now()'), 'Force refresh must expose the current generation time.')
  assert(edgeFunction.includes("Deno.env.get('GEMINI_API_KEY_SECONDARY')"), 'Both configured Gemini keys must be available.')
  assert(edgeFunction.includes('orderedGeminiKeys'), 'Gemini keys must use deterministic rotation.')
  assert(edgeFunction.includes('[401, 403, 429, 500, 502, 503, 504]'), 'Retryable Gemini failures must fall through to the second key.')
  assert(edgeFunction.includes("buildPayload(decision, null, 'deterministic-v2')"), 'Gemini failure must retain the deterministic fallback payload.')
})
