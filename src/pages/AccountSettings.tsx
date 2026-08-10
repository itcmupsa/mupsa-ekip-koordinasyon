import { useEffect, useState, type FormEvent } from 'react'
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

interface AnnouncementRoleOption {
  id: string
  name: string
}

interface AnnouncementMemberOption {
  profileId: string
  displayName: string
  coordinatorRoleName: string | null
}

interface AnnouncementCoordinatorRoleRelation {
  name: string
}

type AnnouncementAudience = 'everyone' | 'coordinator_roles' | 'profiles'

function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export default function AccountSettings({ session }: { session: Session }) {
  const {
    displayName,
    hasActiveMembership,
    periodLabel,
    periodId,
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
  const [announcementOpen, setAnnouncementOpen] = useState(false)
  const [announcementTitle, setAnnouncementTitle] = useState('')
  const [announcementBody, setAnnouncementBody] = useState('')
  const [announcementAudience, setAnnouncementAudience] = useState<AnnouncementAudience>('everyone')
  const [announcementRoleOptions, setAnnouncementRoleOptions] = useState<AnnouncementRoleOption[]>([])
  const [announcementMemberOptions, setAnnouncementMemberOptions] = useState<AnnouncementMemberOption[]>([])
  const [selectedAnnouncementRoleIds, setSelectedAnnouncementRoleIds] = useState<string[]>([])
  const [selectedAnnouncementProfileIds, setSelectedAnnouncementProfileIds] = useState<string[]>([])
  const [announcementScheduledFor, setAnnouncementScheduledFor] = useState('')
  const [announcementLoading, setAnnouncementLoading] = useState(false)
  const [announcementSubmitting, setAnnouncementSubmitting] = useState(false)
  const [announcementMessage, setAnnouncementMessage] = useState<string | null>(null)
  const [announcementError, setAnnouncementError] = useState<string | null>(null)

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

  useEffect(() => {
    if (!isSuperAdmin || !announcementOpen || !periodId) return

    let isMounted = true
    async function loadAnnouncementOptions() {
      setAnnouncementLoading(true)
      setAnnouncementError(null)
      const [rolesResult, membersResult] = await Promise.all([
        supabase
          .from('coordinator_roles')
          .select('id, name')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('period_memberships')
          .select('profile_id, period_display_name, coordinator_roles(name)')
          .eq('period_id', periodId)
          .eq('is_active', true)
          .order('period_display_name'),
      ])

      if (!isMounted) return
      if (rolesResult.error || membersResult.error) {
        setAnnouncementError('Duyuru alıcıları yüklenemedi.')
        setAnnouncementLoading(false)
        return
      }

      setAnnouncementRoleOptions((rolesResult.data ?? []).map((row) => ({
        id: row.id as string,
        name: row.name as string,
      })))
      setAnnouncementMemberOptions((membersResult.data ?? []).map((row) => {
        const role = pickOne(
          row.coordinator_roles as AnnouncementCoordinatorRoleRelation | AnnouncementCoordinatorRoleRelation[] | null | undefined,
        )
        return {
          profileId: row.profile_id as string,
          displayName: (row.period_display_name as string | null) || 'İsimsiz üye',
          coordinatorRoleName: role?.name ?? null,
        }
      }))
      setAnnouncementLoading(false)
    }

    void loadAnnouncementOptions()
    return () => {
      isMounted = false
    }
  }, [announcementOpen, isSuperAdmin, periodId])

  function toggleAnnouncementSelection(
    value: string,
    selectedValues: string[],
    setSelectedValues: (values: string[]) => void,
  ) {
    setSelectedValues(
      selectedValues.includes(value)
        ? selectedValues.filter((selectedValue) => selectedValue !== value)
        : [...selectedValues, value],
    )
  }

  async function handleSendAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAnnouncementMessage(null)
    setAnnouncementError(null)

    const title = announcementTitle.trim()
    const body = announcementBody.trim()
    if (!title || title.length > 120) {
      setAnnouncementError('Başlık 1-120 karakter arasında olmalıdır.')
      return
    }
    if (!body || body.length > 2000) {
      setAnnouncementError('Duyuru metni 1-2000 karakter arasında olmalıdır.')
      return
    }
    if (announcementAudience === 'coordinator_roles' && selectedAnnouncementRoleIds.length === 0) {
      setAnnouncementError('En az bir koordinatörlük seçmelisin.')
      return
    }
    if (announcementAudience === 'profiles' && selectedAnnouncementProfileIds.length === 0) {
      setAnnouncementError('En az bir kişi seçmelisin.')
      return
    }

    let scheduledValue: string | null = null
    if (announcementScheduledFor) {
      const scheduledDate = new Date(announcementScheduledFor)
      if (Number.isNaN(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now()) {
        setAnnouncementError('Gönderim zamanı gelecekte bir tarih ve saat olmalıdır.')
        return
      }
      scheduledValue = scheduledDate.toISOString()
    }

    setAnnouncementSubmitting(true)
    const { data, error } = await supabase.rpc('send_admin_announcement', {
      p_title: title,
      p_body: body,
      p_audience_scope: announcementAudience,
      p_coordinator_role_ids: announcementAudience === 'coordinator_roles' ? selectedAnnouncementRoleIds : [],
      p_profile_ids: announcementAudience === 'profiles' ? selectedAnnouncementProfileIds : [],
      p_scheduled_for: scheduledValue,
    })

    setAnnouncementSubmitting(false)
    if (error) {
      setAnnouncementError(error.message || 'Duyuru gönderilemedi.')
      return
    }

    const result = data as { recipient_count?: number; scheduled_for?: string } | null
    const recipientCount = result?.recipient_count ?? 0
    setAnnouncementMessage(
      scheduledValue
        ? `Duyuru ${recipientCount} kişiye gönderilmek üzere planlandı.`
        : `Duyuru ${recipientCount} kişiye gönderildi.`,
    )
    setAnnouncementTitle('')
    setAnnouncementBody('')
    setAnnouncementAudience('everyone')
    setSelectedAnnouncementRoleIds([])
    setSelectedAnnouncementProfileIds([])
    setAnnouncementScheduledFor('')
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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-ink">Yönetim</h2>
                <button
                  type="button"
                  onClick={() => {
                    setAnnouncementOpen((open) => !open)
                    setAnnouncementMessage(null)
                    setAnnouncementError(null)
                  }}
                  className="rounded-md bg-accent-soft px-3 py-2 text-xs font-medium text-ink"
                >
                  {announcementOpen ? 'Duyuruyu kapat' : 'Duyuru gönder'}
                </button>
              </div>
              <Link to="/app/yonetim/uyeler" className="mt-4 flex items-center justify-between rounded-md border border-canvas-border bg-canvas px-3 py-3 text-sm transition-colors hover:border-ink/30">
                <span><span className="block font-medium text-ink">Ekip ve yetki yönetimi</span><span className="mt-1 block text-xs text-ink-soft">Üyeleri, görünen adları ve uygulama rollerini yönet.</span></span><span className="text-ink-soft" aria-hidden="true">→</span>
              </Link>
              {announcementOpen && <form onSubmit={(event) => void handleSendAnnouncement(event)} className="mt-5 border-t border-canvas-border pt-5">
                <p className="text-sm text-ink-soft">Etkinlik veya görev oluşturmadan, seçtiğin kişilere uygulama ve mobil bildirimi gönder.</p>
                <p className="mt-2 rounded-md border border-accent/20 bg-accent-soft/30 px-3 py-2 text-xs text-ink-soft">Aktif Süper Yöneticiler, hangi alıcı seçilirse seçilsin duyuruyu otomatik alır.</p>
                <div className="mt-4 grid gap-4">
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Başlık
                    <input value={announcementTitle} onChange={(event) => setAnnouncementTitle(event.target.value)} maxLength={120} required className="rounded-md border border-canvas-border bg-canvas px-3 py-2 font-normal outline-none focus:border-ink/40" placeholder="Örn. Yarın bakım yapılacak" />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Duyuru metni
                    <textarea value={announcementBody} onChange={(event) => setAnnouncementBody(event.target.value)} maxLength={2000} required rows={4} className="resize-y rounded-md border border-canvas-border bg-canvas px-3 py-2 font-normal outline-none focus:border-ink/40" placeholder="Göndermek istediğin açıklama" />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Alıcılar
                    <select value={announcementAudience} onChange={(event) => setAnnouncementAudience(event.target.value as AnnouncementAudience)} className="rounded-md border border-canvas-border bg-canvas px-3 py-2 font-normal outline-none focus:border-ink/40">
                      <option value="everyone">Herkes</option>
                      <option value="coordinator_roles">Koordinatörlükler</option>
                      <option value="profiles">Belirli kişiler</option>
                    </select>
                  </label>
                  {announcementAudience === 'coordinator_roles' && <div className="max-h-52 overflow-y-auto rounded-md border border-canvas-border p-2">
                    {announcementLoading ? <p className="p-2 text-xs text-ink-soft">Koordinatörlükler yükleniyor…</p> : announcementRoleOptions.length === 0 ? <p className="p-2 text-xs text-ink-soft">Aktif koordinatörlük bulunamadı.</p> : announcementRoleOptions.map((role) => <label key={role.id} className="flex items-center gap-2 rounded px-2 py-2 text-sm hover:bg-canvas"><input type="checkbox" checked={selectedAnnouncementRoleIds.includes(role.id)} onChange={() => toggleAnnouncementSelection(role.id, selectedAnnouncementRoleIds, setSelectedAnnouncementRoleIds)} />{role.name}</label>)}
                  </div>}
                  {announcementAudience === 'profiles' && <div className="max-h-52 overflow-y-auto rounded-md border border-canvas-border p-2">
                    {announcementLoading ? <p className="p-2 text-xs text-ink-soft">Kişiler yükleniyor…</p> : announcementMemberOptions.length === 0 ? <p className="p-2 text-xs text-ink-soft">Aktif kişi bulunamadı.</p> : announcementMemberOptions.map((member) => <label key={member.profileId} className="flex items-start gap-2 rounded px-2 py-2 text-sm hover:bg-canvas"><input type="checkbox" checked={selectedAnnouncementProfileIds.includes(member.profileId)} onChange={() => toggleAnnouncementSelection(member.profileId, selectedAnnouncementProfileIds, setSelectedAnnouncementProfileIds)} className="mt-0.5" /><span>{member.displayName}{member.coordinatorRoleName && <span className="block text-xs text-ink-soft">{member.coordinatorRoleName}</span>}</span></label>)}
                  </div>}
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Gönderim zamanı <span className="font-normal text-ink-soft">(boş bırakırsan hemen gönderilir)</span>
                    <input type="datetime-local" value={announcementScheduledFor} onChange={(event) => setAnnouncementScheduledFor(event.target.value)} className="rounded-md border border-canvas-border bg-canvas px-3 py-2 font-normal outline-none focus:border-ink/40" />
                  </label>
                  {announcementError && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{announcementError}</p>}
                  {announcementMessage && <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">{announcementMessage}</p>}
                  <button type="submit" disabled={announcementSubmitting || announcementLoading} className="rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                    {announcementSubmitting ? 'Gönderiliyor…' : announcementScheduledFor ? 'Duyuruyu planla' : 'Duyuruyu gönder'}
                  </button>
                </div>
              </form>}
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
