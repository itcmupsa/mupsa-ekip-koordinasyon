const WORKER_VERSION = '2026-11-06.1'

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'MUPSA_WORKER_STATUS' && event.ports?.[0]) {
    event.ports[0].postMessage({ type: 'MUPSA_WORKER_STATUS', version: WORKER_VERSION, handlesFetch: false })
  }
  if (event.data?.type === 'MUPSA_SKIP_WAITING') event.waitUntil(self.skipWaiting())
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
  const targetUrl = new URL(safeNotificationTarget(event.notification.data && event.notification.data.url), self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
      for (const client of clientList) {
        if ('navigate' in client && 'focus' in client) {
          try {
            const navigated = await client.navigate(targetUrl)
            if (navigated) return await navigated.focus()
          } catch {
            // Ask the browser to open a window if an existing iOS client cannot navigate.
          }
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

// Bu worker yalnız bildirimleri yönetir. Sayfa, dosya ve API isteklerini
// tarayıcının normal ağ katmanı karşılar. Cache/fallback sağlamayan bir
// respondWith(fetch(...)) Safari'de ağ hatasını worker navigasyon hatasına çevirir.
