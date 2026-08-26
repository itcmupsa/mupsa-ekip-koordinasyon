import { useCallback, useEffect, useState } from 'react'
import {
  enablePushNotifications,
  syncExistingPushSubscription,
  type PushHealthState,
} from '../lib/pushNotifications'

interface PushHealthBannerProps {
  profileId: string
}

export default function PushHealthBanner({ profileId }: PushHealthBannerProps) {
  const [state, setState] = useState<PushHealthState | 'checking' | 'error'>('checking')
  const [working, setWorking] = useState(false)

  const checkHealth = useCallback(async () => {
    setState('checking')
    try {
      setState(await syncExistingPushSubscription(profileId))
    } catch {
      setState('error')
    }
  }, [profileId])

  useEffect(() => {
    void checkHealth()
  }, [checkHealth])

  async function enableNotifications() {
    setWorking(true)
    try {
      await enablePushNotifications(profileId)
      setState('healthy')
    } catch {
      setState(Notification.permission === 'denied' ? 'permission_denied' : 'error')
    } finally {
      setWorking(false)
    }
  }

  if (state === 'checking' || state === 'healthy' || state === 'unsupported' || state === 'not_configured') return null

  const permissionDenied = state === 'permission_denied'
  const message = permissionDenied
    ? 'Uygulama kapalıyken bildirim alamıyorsun. Tarayıcı veya telefon ayarlarından MUPSA bildirimlerine izin ver.'
    : state === 'error'
      ? 'Bildirim bağlantısı kontrol edilemedi. Bağlantıyı yeniden kontrol et.'
      : 'Uygulama kapalıyken görev ve takvim bildirimlerini alabilmek için bildirimleri etkinleştir.'

  return (
    <section role="status" className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold">Mobil bildirim bağlantın etkin değil</p>
        <p className="mt-1 text-sm text-amber-900/80">{message}</p>
      </div>
      {!permissionDenied ? (
        <button
          type="button"
          disabled={working}
          onClick={() => state === 'error' ? void checkHealth() : void enableNotifications()}
          className="min-h-[44px] shrink-0 rounded-lg bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60"
        >
          {working ? 'Bağlanıyor…' : state === 'error' ? 'Tekrar kontrol et' : 'Bildirimleri aç'}
        </button>
      ) : null}
    </section>
  )
}
