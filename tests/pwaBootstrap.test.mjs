import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { MessageChannel } from 'node:worker_threads'
import test from 'node:test'
import vm from 'node:vm'

const source = await readFile(new URL('../public/pwa-bootstrap.js', import.meta.url), 'utf8')
const version = '2026-11-06.1'
const tick = () => new Promise(resolve => setImmediate(resolve))
function currentWorker(revision = version) {
  return { postMessage: (message, ports) => {
    if (message.type === 'MUPSA_WORKER_STATUS') ports[0].postMessage({ type: 'MUPSA_WORKER_STATUS', version: revision, handlesFetch: false })
  } }
}

function browser({ register, active = currentWorker(), supported = true, fastTimeout = false } = {}) {
  const calls = []
  const window = new EventTarget()
  const document = new EventTarget()
  document.visibilityState = 'visible'
  window.isSecureContext = true
  let now = 10000
  const registration = { active, update: async () => {}, waiting: null }
  const serviceWorker = Object.assign(new EventTarget(), {
    controller: active,
    register: async (url, options) => {
      calls.push({ url, options })
      return register ? register(registration) : registration
    },
    getRegistration: async () => registration,
  })
  Object.defineProperties(window, {
    localStorage: { get() { throw new Error('must not clear session storage') } },
    caches: { get() { throw new Error('must not clear caches') } },
  })
  vm.runInNewContext(source, {
    window, document, navigator: supported ? { serviceWorker } : {}, MessageChannel,
    Date: { now: () => now }, clearTimeout,
    setTimeout: (fn, ms) => setTimeout(fn, fastTimeout ? Math.min(ms, 20) : ms),
  })
  return { window, document, calls, registration, serviceWorker, advance: ms => { now += ms } }
}

test('worker update starts before load/React and reuses the root scope with cache disabled', async () => {
  const { calls, window } = browser()
  await tick()
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, `/sw.js?revision=${version}`)
  assert.equal(calls[0].options.scope, '/')
  assert.equal(calls[0].options.updateViaCache, 'none')
  assert.equal(window.MupsaPwa.version, version)
})

test('foreground updates are throttled and do not run while hidden', async () => {
  const { window, document, calls, advance } = browser()
  await tick()
  window.dispatchEvent(new Event('pageshow'))
  assert.equal(calls.length, 1)
  advance(5 * 60 * 1000)
  document.visibilityState = 'hidden'
  document.dispatchEvent(new Event('visibilitychange'))
  assert.equal(calls.length, 1)
  document.visibilityState = 'visible'
  document.dispatchEvent(new Event('visibilitychange'))
  await tick()
  assert.equal(calls.length, 2)
})

test('recovery waits for the current worker and leaves the existing push subscription untouched', async () => {
  const b = browser({ active: null })
  const subscription = { endpoint: 'test-only-existing-endpoint' }
  b.registration.pushManager = { getSubscription: async () => subscription }
  b.registration.update = async () => {
    b.registration.active = currentWorker()
    b.serviceWorker.controller = b.registration.active
  }
  const result = await b.window.MupsaPwa.repair()
  assert.equal(result.activeVersion, version)
  assert.equal(result.controllerVersion, version)
  assert.equal(await b.registration.pushManager.getSubscription(), subscription)
})

test('concurrent boot and recovery share a registration request', async () => {
  let complete
  const b = browser({ register: registration => new Promise(resolve => { complete = () => resolve(registration) }) })
  const repaired = b.window.MupsaPwa.repair()
  assert.equal(b.calls.length, 1)
  complete()
  assert.equal((await repaired).activeVersion, version)
})

test('the recovery inspection distinguishes a legacy worker with no status reply', async () => {
  const b = browser({ active: { postMessage() {} }, fastTimeout: true })
  const result = await b.window.MupsaPwa.inspect()
  assert.equal(result.activeVersion, null)
  assert.equal(result.controllerVersion, null)
})

test('registration rejection is handled and an explicit retry can succeed', async () => {
  let failing = true
  const b = browser({ register: registration => {
    if (failing) throw new TypeError('Load failed')
    return registration
  } })
  await tick()
  await assert.rejects(b.window.MupsaPwa.repair(), /Load failed/)
  failing = false
  assert.equal((await b.window.MupsaPwa.repair()).activeVersion, version)
})

test('regaining connectivity retries a failed update without waiting five minutes', async () => {
  let failing = true
  const b = browser({ register: registration => {
    if (failing) throw new TypeError('Load failed')
    return registration
  } })
  await tick()
  failing = false
  b.window.dispatchEvent(new Event('online'))
  await tick()
  assert.equal(b.calls.length, 2)
})

test('a stalled registration produces a bounded recovery error instead of success', async () => {
  const b = browser({ register: () => new Promise(() => {}), fastTimeout: true })
  await assert.rejects(b.window.MupsaPwa.repair(), /worker_timeout/)
})

test('unsupported browsers continue without trying to install a worker', async () => {
  const b = browser({ supported: false })
  assert.equal(b.calls.length, 0)
  assert.equal((await b.window.MupsaPwa.inspect()).supported, false)
  await assert.rejects(b.window.MupsaPwa.repair(), /worker_unsupported/)
})

test('the independent recovery page and startup script are served without stale HTTP caching', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'))
  for (const path of ['/sw.js', '/pwa-bootstrap.js', '/pwa-recovery.html', '/pwa-recovery.js']) {
    assert.ok(config.headers.some(rule => rule.source === path && rule.headers.some(header => header.key === 'Cache-Control' && header.value.includes('no-store'))))
  }
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8')
  assert.ok(html.indexOf('/pwa-bootstrap.js') < html.indexOf('/src/main.tsx'))
  const sw = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8')
  assert.ok(sw.includes(`const WORKER_VERSION = '${version}'`))
})

const recoverySource = await readFile(new URL('../public/pwa-recovery.js', import.meta.url), 'utf8')
async function recoveryPage(repair) {
  const fields = new Map(['status', 'repair', 'diagnostics'].map(id => [id, {
    textContent: '', disabled: true, addEventListener(name, listener) { this[name] = listener },
  }]))
  vm.runInNewContext(recoverySource, {
    window: { MupsaPwa: { version, supported: true, repair, inspect: async () => ({ expectedVersion: version }) }, matchMedia: () => ({ matches: true }) },
    navigator: {}, document: { getElementById: id => fields.get(id) }, location: { origin: 'https://mupsa.example' },
  })
  await tick()
  return fields
}

test('recovery does not claim the current screen was fixed if the old controller still owns it', async () => {
  const fields = await recoveryPage(async () => ({ expectedVersion: version, activeVersion: version, controllerVersion: null }))
  await fields.get('repair').click()
  assert.match(fields.get('status').textContent, /hâlâ eski sürümde olabilir/)
  assert.equal(fields.get('repair').disabled, false)
})

test('recovery confirms a current controller and leaves a retry after network failure', async () => {
  let failing = false
  const fields = await recoveryPage(async () => {
    if (failing) throw new TypeError('Load failed')
    return { expectedVersion: version, activeVersion: version, controllerVersion: version }
  })
  await fields.get('repair').click()
  assert.match(fields.get('status').textContent, /Güncel açılış bileşeni doğrulandı/)
  failing = true
  await fields.get('repair').click()
  assert.match(fields.get('status').textContent, /Güncelleme doğrulanamadı/)
  assert.equal(fields.get('repair').disabled, false)
})
