self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { body: event.data ? event.data.text() : '' }
  }

  const title = payload.title || 'MUPSA Ekip Koordinasyon'
  const options = {
    body: payload.body || 'Yeni bir bildirimin var.',
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/favicon.png',
    data: payload.data || { url: '/app' },
    tag: payload.tag || undefined,
    renotify: Boolean(payload.renotify),
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : '/app'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }
      return self.clients.openWindow(targetUrl)
    }),
  )
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Supabase/auth/veritabanı ve yazma istekleri hiçbir şekilde cache'lenmez.
  if (url.origin.includes('supabase.co') || event.request.method !== 'GET') return

  // Şimdilik uygulama verisi cache'lenmez; istek ağdan alınır.
  event.respondWith(fetch(event.request))
})
