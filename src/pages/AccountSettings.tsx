import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useMembershipStatus } from '../hooks/useMembershipStatus'
import {
  disablePushNotifications,
  enablePushNotifications,
  getCurrentPushSubscription,
  getPushSupportState,
  type PushSupportState,
} from '../lib/pushNotifications'

function roleLabel(appRole: string | null): string {
  if (appRole === 'super_admin') return 'Süper Yönetici'
  if (appRole === 'coordinator') return 'Koordinatör'
  return 'Yetki bekliyor'
}

export default function AccountSettings({ session }: { session: Session }) {
  const {
    displayName,
    hasActiveMembership,
    periodLabel,
    profileId,
    appRole,
    coordinatorRoleName,
    loading: membershipLoading,
  } = useMembershipStatus(session)
  const isSuperAdmin = hasActiveMembership && appRole === 'super_admin'
  const [pushSupportState, setPushSupportState] = useState<PushSupportState>('unsupported')
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushActionState, setPushActionState] = useState<'idle' | 'loading'>('idle')
  const [pushError, setPushError] = useState<string | null>(null)

  useEffect(() => {
    if (membershipLoading || !hasActiveMembership || !profileId) return

    let isMounted = true
    async function loadPushState() {
      const supportState = getPushSupportState()
      if (!isMounted) return
      setPushSupportState(supportState)
      if (supportState !== 'supported') return

      try {
        const subscription = await getCurrentPushSubscription()
        if (isMounted) setPushEnabled(Boolean(subscription))
      } catch {
        if (isMounted) setPushError('Bildirim durumu kontrol edilemedi.')
      }
    }

    void loadPushState()
    return () => {
      isMounted = false
    }
  }, [hasActiveMembership, membershipLoading, profileId])

  async function handleEnablePush() {
    if (!profileId || pushSupportState !== 'supported') return
    setPushActionState('loading')
    setPushError(null)
    try {
      await enablePushNotifications(profileId)
      setPushEnabled(true)
    } catch (error) {
      setPushError(error instanceof Error ? error.message : 'Mobil bildirimler açılamadı.')
    } finally {
      setPushActionState('idle')
    }
  }

  async function handleDisablePush() {
    if (!profileId) return
    setPushActionState('loading')
    setPushError(null)
    try {
      await disablePushNotifications(profileId)
      setPushEnabled(false)
    } catch (error) {
      setPushError(error instanceof Error ? error.message : 'Mobil bildirimler kapatılamadı.')
    } finally {
      setPushActionState('idle')
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-screen bg-canvas pb-12">
      <header className="border-b border-canvas-border bg-canvas-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/mupsa-logo.svg" alt="MUPSA Logo" className="h-6 w-auto shrink-0 object-contain" />
            <span className="truncate text-sm font-semibold text-ink">Hesabım ve Ayarlar</span>
          </div>
          <Link to="/app" className="shrink-0 text-sm font-medium text-ink-soft hover:text-ink">Ana sayfa</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
        <div className="mb-6">
          <p className="text-sm text-ink-soft">Hesap ayarları</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink">{displayName || 'Hesabım'}</h1>
          <p className="mt-1 text-sm text-ink-soft">Hesap, güvenlik ve bildirim tercihlerini buradan yönet.</p>
        </div>

        {membershipLoading ? <p className="text-sm text-ink-soft">Hesap bilgileri yükleniyor…</p> : (
          <div className="flex flex-col gap-6">
            <section className="rounded-lg border border-canvas-border bg-canvas-surface p-4 shadow-sm sm:p-6">
              <h2 className="text-base font-semibold text-ink">Hesap bilgileri</h2>
              <dl className="mt-4 divide-y divide-canvas-border text-sm">
                <div className="flex flex-wrap justify-between gap-2 py-3 first:pt-0">
                  <dt className="text-ink-soft">E-posta adresi</dt>
                  <dd className="break-all text-right font-medium text-ink">{session.user.email ?? 'Belirtilmemiş'}</dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2 py-3">
                  <dt className="text-ink-soft">Görünen ad</dt>
                  <dd className="text-right font-medium text-ink">{displayName || 'Belirtilmemiş'}</dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2 py-3">
                  <dt className="text-ink-soft">Aktif dönem</dt>
                  <dd className="text-right font-medium text-ink">{periodLabel ?? 'Aktif üyelik yok'}</dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2 py-3 last:pb-0">
                  <dt className="text-ink-soft">Uygulama rolü</dt>
                  <dd className="text-right font-medium text-ink">{roleLabel(appRole)}</dd>
                </div>
                {coordinatorRoleName && <div className="flex flex-wrap justify-between gap-2 py-3 last:pb-0"><dt className="text-ink-soft">Koordinatörlük</dt><dd className="text-right font-medium text-ink">{coordinatorRoleName}</dd></div>}
              </dl>
              <p className="mt-4 rounded-md border border-accent/20 bg-accent-soft/30 px-3 py-2 text-xs text-ink-soft">
                Görünen ad, dönem kayıtlarının geçmişte doğru kalması için dönem üyeliği üzerinden yönetilir.
              </p>
            </section>

            <section className="rounded-lg border border-canvas-border bg-canvas-surface p-4 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-ink">Mobil bildirimler</h2>
                  <p className="mt-1 text-sm text-ink-soft">Görev ataması, yaklaşan son tarih ve diğer önemli bildirimleri cihazında al.</p>
                </div>
                {pushSupportState === 'supported' && (pushEnabled ? (
                  <button type="button" onClick={() => void handleDisablePush()} disabled={pushActionState === 'loading'} className="rounded-md border border-canvas-border px-3 py-2 text-xs font-medium text-ink-soft disabled:opacity-60">
                    {pushActionState === 'loading' ? 'Kapatılıyor…' : 'Bildirimleri kapat'}
                  </button>
                ) : (
                  <button type="button" onClick={() => void handleEnablePush()} disabled={pushActionState === 'loading'} className="rounded-md bg-accent-soft px-3 py-2 text-xs font-medium text-ink disabled:opacity-60">
                    {pushActionState === 'loading' ? 'Açılıyor…' : 'Bildirimleri aç'}
                  </button>
                ))}
              </div>
              {pushSupportState === 'unsupported' && <p className="mt-3 text-xs text-ink-soft">Bu tarayıcı mobil Web Push bildirimlerini desteklemiyor.</p>}
              {pushSupportState === 'not_configured' && <p className="mt-3 text-xs text-ink-soft">Mobil bildirim yapılandırması henüz tamamlanmadı.</p>}
              {pushSupportState === 'supported' && !pushEnabled && <p className="mt-3 text-xs text-ink-soft">iPhone’da bildirimleri kullanmak için siteyi Ana Ekrana Ekle ve izni bu düğmeden ver.</p>}
              {pushError && <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{pushError}</p>}
            </section>

            <section className="rounded-lg border border-canvas-border bg-canvas-surface p-4 shadow-sm sm:p-6">
              <h2 className="text-base font-semibold text-ink">Güvenlik</h2>
              <Link to="/app/ayarlar/sifre" className="mt-4 flex items-center justify-between rounded-md border border-canvas-border bg-canvas px-3 py-3 text-sm transition-colors hover:border-ink/30">
                <span><span className="block font-medium text-ink">Şifre değiştir</span><span className="mt-1 block text-xs text-ink-soft">Hesap şifreni güncelle.</span></span><span className="text-ink-soft" aria-hidden="true">→</span>
              </Link>
            </section>

            {isSuperAdmin && <section className="rounded-lg border border-canvas-border bg-canvas-surface p-4 shadow-sm sm:p-6">
              <h2 className="text-base font-semibold text-ink">Yönetim</h2>
              <Link to="/app/yonetim/uyeler" className="mt-4 flex items-center justify-between rounded-md border border-canvas-border bg-canvas px-3 py-3 text-sm transition-colors hover:border-ink/30">
                <span><span className="block font-medium text-ink">Ekip ve yetki yönetimi</span><span className="mt-1 block text-xs text-ink-soft">Üyeleri, görünen adları ve uygulama rollerini yönet.</span></span><span className="text-ink-soft" aria-hidden="true">→</span>
              </Link>
            </section>}

            <section className="border-t border-canvas-border pt-6">
              <button type="button" onClick={() => void handleSignOut()} className="text-sm font-medium text-red-700 hover:text-red-800">Çıkış yap</button>
            </section>
          </div>
        )}
      </main>
    </div>
  )
}
