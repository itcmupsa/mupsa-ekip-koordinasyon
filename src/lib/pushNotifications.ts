import { supabase } from './supabaseClient'

export type PushSupportState = 'supported' | 'unsupported' | 'not_configured'
export type PushHealthState = 'healthy' | 'permission_default' | 'permission_denied' | 'missing_subscription' | 'unsupported' | 'not_configured'

// Public VAPID key'i gizli degildir. Ortam degiskeni varsa onu kullanir;
// iki hosting ortami icin de varsayilan anahtarla build ayari olmadan calisir.
const vapidPublicKey = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY || 'BMw3Qixduo1KGqkVxuKpmUhcdmFoe4zHzcmyzB5y-vBAQkuJWTzZA8PebaHF0BzeSwYsFViaFha83K7Jk5Ib6sQ'

function urlBase64ToUint8Array(value: string): Uint8Array {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)))
}

export function getPushSupportState(): PushSupportState {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported'
  }
  return vapidPublicKey ? 'supported' : 'not_configured'
}

export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  if (getPushSupportState() !== 'supported') return null
  const registration = await navigator.serviceWorker.ready
  return registration.pushManager.getSubscription()
}

async function savePushSubscription(profileId: string, subscription: PushSubscription): Promise<void> {
  const subscriptionJson = subscription.toJSON()
  const endpoint = subscriptionJson.endpoint
  const p256dh = subscriptionJson.keys?.p256dh
  const auth = subscriptionJson.keys?.auth

  if (!endpoint || !p256dh || !auth) throw new Error('Bildirim aboneliği eksik bilgiler içeriyor.')

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      profile_id: profileId,
      endpoint,
      p256dh_key: p256dh,
      auth_key: auth,
      content_encoding: 'aes128gcm',
      device_label: navigator.userAgent.slice(0, 120),
      user_agent: navigator.userAgent.slice(0, 500),
      is_active: true,
      last_seen_at: new Date().toISOString(),
      failed_at: null,
    },
    { onConflict: 'endpoint' },
  )

  if (error) throw new Error('Bildirim aboneliği kaydedilemedi.')
}

// Tarayıcıda mevcut olan aboneliği her uygulama açılışında veritabanıyla
// yeniden eşleştirir. Yeni izin istemez; bu yüzden sayfa yüklenirken güvenle
// çalıştırılabilir ve yanlışlıkla pasife düşen kayıtları tekrar etkinleştirir.
export async function syncExistingPushSubscription(profileId: string): Promise<PushHealthState> {
  const supportState = getPushSupportState()
  if (supportState !== 'supported') return supportState
  if (Notification.permission === 'denied') return 'permission_denied'
  if (Notification.permission !== 'granted') return 'permission_default'

  const subscription = await getCurrentPushSubscription()
  if (!subscription) return 'missing_subscription'
  await savePushSubscription(profileId, subscription)
  return 'healthy'
}

export async function enablePushNotifications(profileId: string): Promise<void> {
  if (getPushSupportState() !== 'supported' || !vapidPublicKey) {
    throw new Error('Mobil bildirim yapılandırması henüz tamamlanmamış.')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Bildirim izni verilmedi.')

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
  })
  await savePushSubscription(profileId, subscription)
}

export async function disablePushNotifications(profileId: string): Promise<void> {
  const subscription = await getCurrentPushSubscription()
  if (!subscription) return

  const endpoint = subscription.endpoint
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('profile_id', profileId)
    .eq('endpoint', endpoint)

  if (error) throw new Error('Bildirim aboneliği kaldırılamadı.')
  await subscription.unsubscribe()
}
