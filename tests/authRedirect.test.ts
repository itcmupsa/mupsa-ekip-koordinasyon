import assert from 'node:assert/strict'
import test from 'node:test'
import { loginPathFor, safeAppReturnTo } from '../src/lib/authRedirect.ts'

test('keeps internal app routes including query and hash', () => {
  assert.equal(
    safeAppReturnTo('/app/ayarlar?section=appearance#appearance'),
    '/app/ayarlar?section=appearance#appearance',
  )
})

test('rejects external and non-app return targets', () => {
  for (const target of ['https://example.com/app', '//example.com/app', '/login', 'javascript:alert(1)']) {
    assert.equal(safeAppReturnTo(target), '/app')
  }
})

test('creates an encoded login path from a protected app route', () => {
  assert.equal(
    loginPathFor('/app/ayarlar?section=appearance'),
    '/login?returnTo=%2Fapp%2Fayarlar%3Fsection%3Dappearance',
  )
})
