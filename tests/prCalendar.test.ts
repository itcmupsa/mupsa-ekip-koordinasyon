import { strict as assert } from 'node:assert'
import test from 'node:test'
import { addDays, formatOptionalTime, formatWeekRange, isHexColor, isSafeExternalUrl, normalizePrReferenceLinks, parsePrReferenceLinks, validatePrReferenceLinks, mondayOfWeek, parseDateOnly, shiftMonth, weekDates, extractManualAssignees, extractAutoAssignees, computeLegacyResponsibleId, buildNonManagerPayload } from '../src/lib/prCalendar.ts'

test('extractManualAssignees and extractAutoAssignees', () => {
  const data = [
    { profile_id: '1', assignment_source: 'manual' },
    { profile_id: '2', assignment_source: 'event_owner' },
    { profile_id: '3', assignment_source: 'awareness_responsible' },
    { profile_id: '4', assignment_source: 'invalid' },
    null,
  ]
  assert.deepEqual(extractManualAssignees(data), ['1'])
  assert.deepEqual(extractAutoAssignees(data), [
    { profileId: '2', source: 'event_owner' },
    { profileId: '3', source: 'awareness_responsible' }
  ])
  assert.deepEqual(extractManualAssignees(null), [])
})

test('weekly board starts on Monday across a year boundary', () => {
  assert.equal(mondayOfWeek('2027-01-01'), '2026-12-28')
  assert.deepEqual(weekDates('2026-12-28'), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03'])
  assert.equal(addDays('2026-12-31', 1), '2027-01-01')
  assert.equal(formatWeekRange('2026-10-12'), '12 – 18 Ekim 2026')
  assert.equal(formatWeekRange('2026-12-28'), '28 Aralık 2026 – 3 Ocak 2027')
})

test('month navigation and optional times are stable', () => {
  assert.equal(shiftMonth('2026-01-15', -1), '2025-12-01')
  assert.equal(shiftMonth('2026-12-15', 1), '2027-01-01')
  assert.equal(formatOptionalTime(null), 'Saat belirtilmedi')
  assert.equal(formatOptionalTime('09:30:00'), '09:30')
})

test('external links and colours are safely validated', () => {
  assert.equal(isSafeExternalUrl('https://mupsa.example/path'), true)
  assert.equal(isSafeExternalUrl('javascript:alert(1)'), false)
  assert.equal(isHexColor('#16a34a'), true)
  assert.equal(isHexColor('#bad'), false)
})

test('legacy PR links are presented through the multiple-link model', () => {
  assert.deepEqual(parsePrReferenceLinks(null, 'Tasarım dosyası', 'https://drive.google.com/example'), [
    { id: 'legacy-reference-link', label: 'Tasarım dosyası', url: 'https://drive.google.com/example' },
  ])
  assert.deepEqual(parsePrReferenceLinks([], null, 'https://instagram.com/p/example'), [
    { id: 'legacy-reference-link', label: 'Harici bağlantı', url: 'https://instagram.com/p/example' },
  ])
})

test('multiple PR links are normalized and validated as complete pairs', () => {
  const links = [
    { id: 'instagram', label: ' Instagram gönderisi ', url: ' https://instagram.com/p/example ' },
    { id: 'drive', label: 'Drive dosyası', url: 'https://drive.google.com/example' },
  ]
  assert.deepEqual(normalizePrReferenceLinks(links), [
    { id: 'instagram', label: 'Instagram gönderisi', url: 'https://instagram.com/p/example' },
    { id: 'drive', label: 'Drive dosyası', url: 'https://drive.google.com/example' },
  ])
  assert.equal(validatePrReferenceLinks(links), null)
  assert.equal(validatePrReferenceLinks([{ id: 'broken', label: 'Drive', url: '' }]), '1. bağlantı için bir adres girin.')
  assert.equal(validatePrReferenceLinks([
    { id: 'one', label: 'Bir', url: 'https://example.com' },
    { id: 'two', label: 'İki', url: 'https://example.com' },
  ]), 'Aynı bağlantı adresini birden fazla kez ekleyemezsiniz.')
})

test('invalid calendar dates cannot silently roll into another month', () => {
  assert.ok(Number.isNaN(parseDateOnly('2026-02-30').getTime()))
  assert.ok(Number.isNaN(parseDateOnly('invalid').getTime()))
  assert.equal(parseDateOnly('2028-02-29').toISOString().slice(0, 10), '2028-02-29')
})

test('computeLegacyResponsibleId keeps existing if still assigned manually, otherwise uses first manual', () => {
  assert.equal(computeLegacyResponsibleId('id1', ['id1', 'id2']), 'id1')
  assert.equal(computeLegacyResponsibleId('id2', ['id1', 'id2']), 'id2')
  assert.equal(computeLegacyResponsibleId('id3', ['id1', 'id2']), 'id1')
  assert.equal(computeLegacyResponsibleId(null, ['id1', 'id2']), 'id1')
  assert.equal(computeLegacyResponsibleId('id1', []), null)
  assert.equal(computeLegacyResponsibleId(null, []), null)
})

test('buildNonManagerPayload correctly formats operational fields without forbidden keys', () => {
  const draft = {
    title: '  My PR Title  ',
    entryKind: 'publication',
    scheduledDate: '2026-10-10',
    scheduledTime: '10:00',
    color: '#123456',
    status: 'planned',
    channels: ['instagram'],
    format: ' Reel  ',
    notes: '   Some notes   ',
    responsibleId: 'should_be_ignored',
    eventId: 'ignored_event',
    awarenessPostId: 'ignored_awareness',
    taskId: 'ignored_task',
    relatedPrEntryId: 'ignored_related',
    manualAssigneeIds: ['ignored'],
  }
  const links = [{ id: '1', label: 'L', url: 'https://e.com' }]
  const payload = buildNonManagerPayload(draft, links)

  assert.deepEqual(payload, {
    title: 'My PR Title',
    entry_kind: 'publication',
    scheduled_date: '2026-10-10',
    scheduled_time: '10:00',
    color: '#123456',
    status: 'planned',
    channels: ['instagram'],
    channel: 'instagram',
    format: 'Reel',
    notes: 'Some notes',
    reference_links: links,
    reference_label: 'L',
    reference_url: 'https://e.com',
  })

  // Ensure forbidden fields are not present
  assert.ok(!('responsible_id' in payload))
  assert.ok(!('event_id' in payload))
  assert.ok(!('awareness_post_id' in payload))
  assert.ok(!('task_id' in payload))
  assert.ok(!('related_pr_entry_id' in payload))
  assert.ok(!('period_id' in payload))
  assert.ok(!('created_by' in payload))
})
