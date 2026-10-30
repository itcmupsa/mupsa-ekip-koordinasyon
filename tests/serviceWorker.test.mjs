import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'

const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8')
function worker() {
  const handlers = new Map()
  const notifications = []
  const opened = []
  const self = {
    addEventListener: (name, handler) => handlers.set(name, handler),
    skipWaiting: async () => {},
    location: { origin: 'https://mupsa.example' },
    clients: { claim: async () => {}, matchAll: async () => [], openWindow: async url => opened.push(url) },
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
    assert.deepEqual(opened, [expected])
  }
})
