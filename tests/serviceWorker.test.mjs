import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'

const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8')
function worker(clients = []) {
  const handlers = new Map()
  const notifications = []
  const opened = []
  const self = {
    addEventListener: (name, handler) => handlers.set(name, handler),
    skipWaiting: async () => {},
    location: { origin: 'https://mupsa.example' },
    clients: { claim: async () => {}, matchAll: async () => clients, openWindow: async url => opened.push(url) },
    registration: { showNotification: async (title, options) => notifications.push({ title, options }) },
  }
  vm.runInNewContext(source, { self, URL })
  return { handlers, notifications, opened }
}

test('navigation, assets and API requests remain with the browser network stack', () => {
  const { handlers } = worker()
  assert.equal(handlers.has('fetch'), false)
})

test('push notifications still display their content', async () => {
  const { handlers, notifications } = worker()
  let work
  handlers.get('push')({ data: { json: () => ({ title: 'Deneme', body: 'Bildirim metni' }) }, waitUntil: promise => { work = promise } })
  await work
  assert.equal(notifications[0].title, 'Deneme')
  assert.equal(notifications[0].options.body, 'Bildirim metni')
})

test('notification clicks preserve internal links and reject external destinations', async () => {
  for (const [target, expected] of [['/app/takvimler/pr?date=2026-10-30', '/app/takvimler/pr?date=2026-10-30'], ['https://other.example/app', '/app']]) {
    const { handlers, opened } = worker()
    let work
    handlers.get('notificationclick')({ notification: { close() {}, data: { url: target } }, waitUntil: promise => { work = promise } })
    await work
    assert.deepEqual(opened, [`https://mupsa.example${expected}`])
  }
})

test('worker reports a verifiable version without intercepting network requests', () => {
  const { handlers } = worker()
  let status
  handlers.get('message')({ data: { type: 'MUPSA_WORKER_STATUS' }, ports: [{ postMessage: value => { status = value } }] })
  assert.equal(status.type, 'MUPSA_WORKER_STATUS')
  assert.equal(status.version, '2026-11-06.1')
  assert.equal(status.handlesFetch, false)
})

test('notification click keeps navigation alive before focusing an existing client', async () => {
  const actions = []
  let finishNavigation
  const client = {
    navigate: url => {
      actions.push(url)
      return new Promise(resolve => { finishNavigation = () => resolve(client) })
    },
    focus: async () => { actions.push('focus') },
  }
  const { handlers, opened } = worker([client])
  let work
  handlers.get('notificationclick')({ notification: { close() {}, data: { url: '/app/gorevler' } }, waitUntil: promise => { work = promise } })
  await Promise.resolve()
  assert.deepEqual(actions, ['https://mupsa.example/app/gorevler'])
  finishNavigation()
  await work
  assert.deepEqual(actions, ['https://mupsa.example/app/gorevler', 'focus'])
  assert.deepEqual(opened, [])
})

test('a failed existing iOS window falls back to opening the safe destination', async () => {
  const { handlers, opened } = worker([{ navigate: async () => { throw new TypeError('Load failed') }, focus() { throw new Error('must not focus failed navigation') } }])
  let work
  handlers.get('notificationclick')({ notification: { close() {}, data: { url: '/app' } }, waitUntil: promise => { work = promise } })
  await work
  assert.deepEqual(opened, ['https://mupsa.example/app'])
})
