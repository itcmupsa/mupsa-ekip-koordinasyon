import { strict as assert } from 'node:assert'
import test from 'node:test'
import { addDays, formatOptionalTime, formatWeekRange, isHexColor, isSafeExternalUrl, normalizePrReferenceLinks, parsePrReferenceLinks, validatePrReferenceLinks, mondayOfWeek, parseDateOnly, shiftMonth, weekDates } from '../src/lib/prCalendar.ts'

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
