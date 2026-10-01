import { strict as assert } from 'node:assert'
import test from 'node:test'
import { assigneeRoles, planCreationUrl, publicationProgress, uniqueAssigneeIds, type PublicationRow } from '../src/lib/publicationPlan.ts'

const row = (status: PublicationRow['status'], extra: Partial<PublicationRow> = {}): PublicationRow => ({
  id: 'p1', title: 'Yayın', event_id: 'event', awareness_post_id: null, entry_kind: 'publication', status,
  scheduled_date: '2026-10-01', scheduled_time: '12:00:00', channels: ['Instagram'], reference_links: [], reference_label: null, reference_url: null, assignees: [], ...extra,
})
test('one person is displayed once while both assignment sources remain', () => {
  const assignees = [{ profileId: '1', assignmentSource: 'manual' as const }, { profileId: '1', assignmentSource: 'event_owner' as const }]
  assert.deepEqual(uniqueAssigneeIds(assignees), ['1'])
  assert.equal(assigneeRoles(assignees, '1'), 'İçeriğe atanan · Etkinlik yetkilisi')
  assert.equal(assignees.length, 2)
})
test('one finished publication does not mark the whole source published', () => {
  assert.equal(publicationProgress([row('completed'), row('planned')]).shared, false)
  assert.equal(publicationProgress([row('completed'), row('completed')]).shared, true)
  assert.equal(publicationProgress([]).shared, false)
  assert.equal(publicationProgress([row('completed', { entry_kind: 'shooting' })]).shared, false)
})
test('Istanbul schedule determines delay; cancelled and completed work is excluded', () => {
  const before = new Date('2026-10-01T08:59:00Z')
  const after = new Date('2026-10-01T09:01:00Z')
  assert.equal(publicationProgress([row('ready')], before).delayed, false)
  assert.equal(publicationProgress([row('ready')], after).delayed, true)
  assert.equal(publicationProgress([row('cancelled'), row('completed')], after).delayed, false)
  assert.equal(publicationProgress([row('planned', { scheduled_time: null })], after).delayed, false)
})
test('create links retain explicit source identity', () => {
  assert.equal(planCreationUrl('event', 'a/b'), '/app/takvimler/pr?new=1&event=a%2Fb')
  assert.equal(planCreationUrl('awareness', 'post'), '/app/takvimler/pr?new=1&awareness=post')
})
