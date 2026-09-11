import { strict as assert } from 'node:assert'
import test from 'node:test'
import { addDays, formatOptionalTime, isHexColor, isSafeExternalUrl, mondayOfWeek, shiftMonth, weekDates } from '../src/lib/prCalendar.ts'

test('weekly board starts on Monday across a year boundary', () => {
  assert.equal(mondayOfWeek('2027-01-01'), '2026-12-28')
  assert.deepEqual(weekDates('2026-12-28'), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03'])
  assert.equal(addDays('2026-12-31', 1), '2027-01-01')
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
