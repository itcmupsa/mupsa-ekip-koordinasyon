import { supabase } from './supabaseClient'

export type PushSupportState = 'supported' | 'unsupported' | 'not_configured'
export type PushHealthState = 'healthy' | 'permission_default' | 'permission_denied' | 'missing_subscription' | 'unsupported' | 'not_configured'

// Public VAPID key gizli degildir, ancak frontend eski bir anahtara sessizce
// dusmemelidir. Ortam ayari yoksa push ozelligi guvenli bicimde "not_configured"
// durumunda kalir.
const vapidPublicKey = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY?.trim() ?? ''
const PUSH_DISABLED_STORAGE_KEY = 'mupsa_push_disabled'

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

async function savePushSubscription(subscription: PushSubscription): Promise<void> {
  const subscriptionJson = subscription.toJSON()
  const endpoint = subscriptionJson.endpoint
  const p256dh = subscriptionJson.keys?.p256dh
  const auth = subscriptionJson.keys?.auth

  if (!endpoint || !p256dh || !auth) throw new Error('Bildirim aboneliği eksik bilgiler içeriyor.')

  const { error } = await supabase.rpc('sync_push_subscription', {
    p_endpoint: endpoint,
    p_p256dh_key: p256dh,
    p_auth_key: auth,
    p_content_encoding: 'aes128gcm',
    p_device_label: navigator.userAgent.slice(0, 120),
    p_user_agent: navigator.userAgent.slice(0, 500),
  })

  if (error) throw new Error('Bildirim aboneliği kaydedilemedi.')
}

// Tarayıcıda mevcut olan aboneliği her uygulama açılışında veritabanıyla
// yeniden eşleştirir. Yeni izin istemez; bu yüzden sayfa yüklenirken güvenle
// çalıştırılabilir ve yanlışlıkla pasife düşen kayıtları tekrar etkinleştirir.
export async function syncExistingPushSubscription(profileId: string): Promise<PushHealthState> {
  void profileId // RPC ownership is derived from auth.uid(); parameter kept for call-site compatibility.
  const supportState = getPushSupportState()
  if (supportState !== 'supported') return supportState
  if (Notification.permission === 'denied') return 'permission_denied'
  if (Notification.permission !== 'granted') return 'permission_default'
  if (window.localStorage.getItem(PUSH_DISABLED_STORAGE_KEY) === '1') return 'missing_subscription'

  let subscription = await getCurrentPushSubscription()
  if (!subscription) {
    const registration = await navigator.serviceWorker.ready
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    })
  }
  await savePushSubscription(subscription)
  return 'healthy'
}

export async function enablePushNotifications(profileId: string): Promise<void> {
  void profileId // RPC ownership is derived from auth.uid(); parameter kept for call-site compatibility.
  if (getPushSupportState() !== 'supported' || !vapidPublicKey) {
    throw new Error('Mobil bildirim yapılandırması henüz tamamlanmamış.')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Bildirim izni verilmedi.')

  window.localStorage.removeItem(PUSH_DISABLED_STORAGE_KEY)
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
  })
  await savePushSubscription(subscription)
}

export async function disablePushNotifications(profileId: string): Promise<void> {
  window.localStorage.setItem(PUSH_DISABLED_STORAGE_KEY, '1')
  const subscription = await getCurrentPushSubscription()
  if (!subscription) return

  const endpoint = subscription.endpoint
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('profile_id', profileId)
    .eq('endpoint', endpoint)

  let unsubscribeFailed = false
  try {
    await subscription.unsubscribe()
  } catch {
    unsubscribeFailed = true
  }

  if (error) throw new Error('Bildirim aboneliği sunucudan kaldırılamadı; cihaz aboneliği kapatılmaya çalışıldı.')
  if (unsubscribeFailed) throw new Error('Bildirim aboneliği cihazda kapatılamadı.')
}

// Logout'ta eski kullaniciya ait endpoint'in bu browser'da kullanilmasina devam
// etmemesi gizlilik icin subscription korunmasindan daha onemlidir. DB bagini siler
// ve browser subscription'i iptal ederiz. Bu, "bildirimleri kapat" tercihi degildir;
// local opt-out yazilmaz. Sonraki login'de izin halen granted ise app acilis sync'i
// yeni subscription'i sessizce kurabilir.
export async function detachPushSubscriptionForLogout(profileId: string): Promise<void> {
  const subscription = await getCurrentPushSubscription()
  if (!subscription) return

  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('profile_id', profileId)
    .eq('endpoint', subscription.endpoint)

  try {
    await subscription.unsubscribe()
  } catch {
    // Eski DB satiri kalsa bile provider 404/410 verdiginde server pasiflestirir.
  }
}
