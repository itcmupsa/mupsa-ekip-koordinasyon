self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Supabase/auth/veritabanı ve yazma istekleri hiçbir şekilde cache'lenmez.
  if (url.origin.includes('supabase.co') || event.request.method !== 'GET') return

  // Şimdilik uygulama verisi cache'lenmez; istek ağdan alınır.
  event.respondWith(fetch(event.request))
})
