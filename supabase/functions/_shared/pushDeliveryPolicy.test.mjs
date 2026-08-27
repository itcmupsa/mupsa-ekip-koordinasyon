import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildSafePayload,
  isExpiredSubscriptionError,
  isTransientSubscriptionError,
  MAX_PUSH_PAYLOAD_BYTES,
  payloadBytes,
  RETRY_DELAYS_SECONDS,
  safeAppUrl,
  WEB_PUSH_TTL_SECONDS,
} from './pushDeliveryPolicy.ts'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const migrationPath = path.resolve(
  currentDir,
  '../../migrations/20260827231000_harden_web_push_delivery.sql',
)

function makeInput(overrides = {}) {
  return {
    notificationId: 'notification-1',
    title: 'MUPSA bildirimi',
    body: 'Kısa bildirim',
    eventId: null,
    taskId: null,
    metadata: {},
    ...overrides,
  }
}

test('push TTL 28 gün ve retry planı günlere kadar uzanır', () => {
  assert.equal(WEB_PUSH_TTL_SECONDS, 28 * 24 * 60 * 60)
  assert.deepEqual([...RETRY_DELAYS_SECONDS], [
    60,
    300,
    900,
    3600,
    21600,
    86400,
    172800,
    345600,
    604800,
  ])
})

test('404 ve 410 eski abonelik sayılır; 429/5xx geçici hata sayılır', () => {
  assert.equal(isExpiredSubscriptionError({ statusCode: 404 }), true)
  assert.equal(isExpiredSubscriptionError({ statusCode: 410 }), true)
  assert.equal(isExpiredSubscriptionError({ statusCode: 500 }), false)
  assert.equal(isTransientSubscriptionError({ statusCode: 429 }), true)
  assert.equal(isTransientSubscriptionError({ statusCode: 503 }), true)
  assert.equal(isTransientSubscriptionError({ statusCode: 400 }), false)
})

test('bildirim tıklama hedefi yalnız uygulama içi güvenli yola gider', () => {
  assert.equal(safeAppUrl('/app/gorevler', null), '/app/gorevler')
  assert.equal(safeAppUrl('https://example.com/phishing', null), '/app')
  assert.equal(safeAppUrl('//example.com/phishing', 'event-1'), '/app/etkinlikler/event-1')
})

test('uzun Türkçe/Unicode push gövdesi güvenli byte sınırına kısaltılır', () => {
  const payload = buildSafePayload(makeInput({
    body: 'Çok önemli duyuru 🔔 '.repeat(600),
    metadata: { url: '/app' },
  }))

  assert.ok(payloadBytes(payload) <= MAX_PUSH_PAYLOAD_BYTES)
  assert.ok(payload.body.length > 0)
  assert.notEqual(payload.body, 'Çok önemli duyuru 🔔 '.repeat(600))
})

test('push hardening migration kritik eşzamanlılık ve RLS korumalarını içerir', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8').toLowerCase()

  assert.match(sql, /unique\s*\(notification_id,\s*subscription_id\)/)
  assert.match(sql, /for update of d skip locked/)
  assert.match(sql, /delivery_state = 'processing'/)
  assert.match(sql, /processing_started_at < now\(\) - interval '10 minutes'/)
  assert.match(sql, /revoke update on table public\.notifications from authenticated/)
  assert.match(sql, /grant update \(read_at\) on table public\.notifications to authenticated/)
  assert.match(sql, /grant execute on function public\.claim_push_notification_deliveries\(integer\) to service_role/)
})
