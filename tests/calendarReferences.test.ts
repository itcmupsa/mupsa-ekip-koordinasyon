import assert from 'node:assert/strict'
import test from 'node:test'
import {
  classifyAwarenessReference,
  countDistinctSources,
  dateKeyOrNull,
  dateRangeIntersects,
  getEventReferenceDate,
  uniqueByIdentity,
  partitionManualCalendarRecords,
  isReferenceVisible,
  upcomingRangeDate,
} from '../src/lib/calendarReferences.ts'

test('dateKeyOrNull accepts real date-only keys and rejects invalid inputs', () => {
  assert.equal(dateKeyOrNull('2026-10-01'), '2026-10-01')
  assert.equal(dateKeyOrNull('2026-02-29'), null)
  assert.equal(dateKeyOrNull('2024-02-29'), '2024-02-29')
  assert.equal(dateKeyOrNull('2026-13-01'), null)
  assert.equal(dateKeyOrNull('2026-10-01T00:00:00Z'), null)
  assert.equal(dateKeyOrNull(null), null)
})

test('dateRangeIntersects treats both endpoints as inclusive across month and year boundaries', () => {
  assert.equal(dateRangeIntersects('2026-09-30', '2026-10-02', '2026-10-01', '2026-10-07'), true)
  assert.equal(dateRangeIntersects('2026-12-28', '2027-01-04', '2027-01-01', '2027-01-07'), true)
  assert.equal(dateRangeIntersects('2026-09-01', '2026-09-30', '2026-10-01', '2026-10-07'), false)
  assert.equal(dateRangeIntersects('2026-10-08', '2026-10-10', '2026-10-01', '2026-10-07'), false)
  assert.equal(dateRangeIntersects('2026-10-07', '2026-10-12', '2026-10-01', '2026-10-07'), true)
  assert.equal(dateRangeIntersects('2026-10-07', '2026-10-12', '2026-10-08', '2026-10-14'), true)
  assert.equal(dateRangeIntersects('2026-10-07', '2026-10-07', '2026-10-07', '2026-10-07'), true)
  assert.equal(dateRangeIntersects('2026-10-03', '2026-10-02', '2026-10-01', '2026-10-07'), false)
  assert.equal(dateRangeIntersects('invalid', '2026-10-03', '2026-10-01', '2026-10-07'), false)
})

test('single-day awareness dates are markers, while multi-day awareness is one range', () => {
  assert.deepEqual(
    classifyAwarenessReference('2026-10-10', '2026-10-10', '2026-10-12'),
    { kind: 'day', date: '2026-10-10' },
  )
  assert.deepEqual(
    classifyAwarenessReference('2026-10-01', '2026-10-31', '2026-10-05'),
    { kind: 'range', start: '2026-10-01', end: '2026-10-31' },
  )
  assert.deepEqual(classifyAwarenessReference(null, null, '2026-10-05'), { kind: 'day', date: '2026-10-05' })
  assert.deepEqual(classifyAwarenessReference('2026-10-05', null, null), { kind: 'day', date: '2026-10-05' })
  assert.equal(classifyAwarenessReference('2026-10-31', '2026-10-01', null), null)
  assert.equal(classifyAwarenessReference('2026-10-01', 'bad-date', '2026-10-05'), null)
  assert.equal(classifyAwarenessReference('bad-date', null, '2026-10-05'), null)
})

test('event reference prefers confirmed date and falls back to estimated date only', () => {
  assert.equal(getEventReferenceDate('2026-10-12', '2026-10-10'), '2026-10-12')
  assert.equal(getEventReferenceDate(null, '2026-10-10'), '2026-10-10')
  assert.equal(getEventReferenceDate('bad-date', '2026-10-10'), '2026-10-10')
  assert.equal(getEventReferenceDate(null, null), null)
})

test('unique source helpers avoid duplicate records and count expanded markers once', () => {
  const sources = [
    { type: 'manual-event', id: 'meeting-1', date: '2026-10-05' },
    { type: 'manual-event', id: 'meeting-1', date: '2026-10-05' },
    { type: 'awareness', id: 'aware-1', date: '2026-10-01' },
    { type: 'awareness', id: 'aware-1', date: '2026-10-02' },
  ]
  const sourceIdentity = (item: (typeof sources)[number]) => `${item.type}:${item.id}`
  assert.equal(uniqueByIdentity(sources, sourceIdentity).length, 2)
  assert.equal(countDistinctSources(sources, sourceIdentity), 2)
})

test('manual records keep PR cards separate from active source references without duplicates', () => {
  const records = [
    { id: 'pr', calendar_scopes: ['pr', 'events', 'awareness'], deleted_at: null },
    { id: 'event', calendar_scopes: ['events', 'awareness'], deleted_at: null },
    { id: 'event', calendar_scopes: ['events', 'awareness'], deleted_at: null },
    { id: 'awareness', calendar_scopes: ['awareness'], deleted_at: null },
    { id: 'deleted-event', calendar_scopes: ['events'], deleted_at: '2026-10-01' },
    { id: 'deleted-awareness', calendar_scopes: ['awareness'], deleted_at: '2026-10-01' },
    { id: 'deleted-pr', calendar_scopes: ['pr'], deleted_at: '2026-10-01' },
  ]
  const partition = partitionManualCalendarRecords(records)
  assert.deepEqual(partition.pr.map(item => item.id), ['pr', 'deleted-pr'])
  assert.deepEqual(partition.events.map(item => item.id), ['event'])
  assert.deepEqual(partition.awareness.map(item => item.id), ['awareness'])
})

test('source details disappear outside the displayed window while ongoing ranges stay visible', () => {
  const day = { kind: 'day' as const, date: '2026-10-10' }
  assert.equal(isReferenceVisible(day, '2026-10-05', '2026-10-11'), true)
  assert.equal(isReferenceVisible(day, '2026-10-12', '2026-10-18'), false)
  const range = { kind: 'range' as const, start: '2026-10-01', end: '2026-10-31' }
  assert.equal(isReferenceVisible(range, '2026-10-12', '2026-10-18'), true)
  assert.equal(isReferenceVisible(range, '2026-11-01', '2026-11-30'), false)
})

test('upcoming manual ranges appear at their start or today while still ongoing', () => {
  assert.equal(upcomingRangeDate('2026-10-10', '2026-10-31', '2026-10-01'), '2026-10-10')
  assert.equal(upcomingRangeDate('2026-09-20', '2026-10-31', '2026-10-01'), '2026-10-01')
  assert.equal(upcomingRangeDate('2026-09-20', '2026-10-01', '2026-10-01'), '2026-10-01')
  assert.equal(upcomingRangeDate('2026-12-28', '2027-01-04', '2027-01-01'), '2027-01-01')
})

test('ended and invalid manual ranges are excluded; single days keep their date', () => {
  assert.equal(upcomingRangeDate('2026-09-01', '2026-09-30', '2026-10-01'), null)
  assert.equal(upcomingRangeDate('2026-10-10', null, '2026-10-01'), '2026-10-10')
  assert.equal(upcomingRangeDate('2026-09-30', null, '2026-10-01'), null)
  assert.equal(upcomingRangeDate('2026-10-31', '2026-10-01', '2026-10-01'), null)
  assert.equal(upcomingRangeDate('bad-date', null, '2026-10-01'), null)
  assert.equal(upcomingRangeDate('2026-10-01', 'bad-date', '2026-10-01'), null)
})
