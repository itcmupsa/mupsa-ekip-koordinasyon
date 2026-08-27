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

function safeNotificationTarget(candidate) {
  try {
    const parsed = new URL(typeof candidate === 'string' ? candidate : '/app', self.location.origin)
    const isAllowedPath = parsed.pathname === '/app' || parsed.pathname.startsWith('/app/')
    if (parsed.origin !== self.location.origin || !isAllowedPath) return '/app'
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return '/app'
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = safeNotificationTarget(event.notification.data && event.notification.data.url)

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

// pushsubscriptionchange tarayici destegine baglidir. Destekleyen tarayicilarda
// browser aboneligini yeniden olusturmaya calisir; sunucuya guvenli senkron icin
// authenticated bir sayfa gerekir, bu nedenle acik client'lara haber verir. Sayfa
// kapaliysa normal uygulama acilisindaki sync fallback'i devreye girer.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    try {
      const applicationServerKey = event.oldSubscription
        && event.oldSubscription.options
        && event.oldSubscription.options.applicationServerKey
      if (!applicationServerKey) return

      await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      })

      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of clientList) {
        client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED' })
      }
    } catch {
      // Tarayici destegi sinirli olabilir; uygulama acilisindaki sync ana fallback'tir.
    }
  })())
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Supabase/auth/veritabanı ve yazma istekleri hiçbir şekilde cache'lenmez.
  if (url.origin.includes('supabase.co') || event.request.method !== 'GET') return

  // Şimdilik uygulama verisi cache'lenmez; istek ağdan alınır.
  event.respondWith(fetch(event.request))
})
