import { useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
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
type AnnouncementScheduleMode = 'now' | 'scheduled'

const fieldClass = 'min-h-[44px] rounded-lg border border-canvas-border bg-canvas-surface px-3 py-2.5 font-normal text-ink placeholder:text-ink-soft/70 focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/15 disabled:opacity-60'

function ChevronIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
}

function BellIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><path d="M6 10.5a6 6 0 0 1 12 0v4l1.5 2.5h-15L6 14.5zM10 19.5a2 2 0 0 0 4 0" /></svg>
}

function ShieldIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><path d="M12 3 5 6v5c0 4.8 2.8 8.1 7 10 4.2-1.9 7-5.2 7-10V6zM9 12l2 2 4-4" /></svg>
}

function TeamIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><circle cx="9" cy="8" r="3" /><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0M15.5 12.5a4.5 4.5 0 0 1 5 4.5M17 5.5a2.5 2.5 0 0 1 0 5" /></svg>
}

function MegaphoneIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><path d="M4 10v3a1 1 0 0 0 1 1h2l4.5 3.5v-11L7 10H5a1 1 0 0 0-1 1zM16.5 9a4 4 0 0 1 0 6" /></svg>
}

function CalendarIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="16" rx="2" /><path d="M3.5 9.5h17M8 3v3M16 3v3" /></svg>
}

function ClockIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v5l3 2" /></svg>
}

const announcementHours = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'))
const announcementMinutes = ['00', '15', '30', '45']

function localDateValue(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

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
    coordinatorRoleSlug,
    loading: membershipLoading,
  } = useMembershipStatus(session)
  const isSuperAdmin = hasActiveMembership && appRole === 'super_admin'
  const canSendAnnouncements = isSuperAdmin || (
    hasActiveMembership && coordinatorRoleSlug === 'general-secretary'
  )
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
  const [announcementScheduleMode, setAnnouncementScheduleMode] = useState<AnnouncementScheduleMode>('now')
  const [announcementScheduleDate, setAnnouncementScheduleDate] = useState('')
  const [announcementScheduleHour, setAnnouncementScheduleHour] = useState('09')
  const [announcementScheduleMinute, setAnnouncementScheduleMinute] = useState('00')
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
    if (!canSendAnnouncements || !announcementOpen || !periodId) return

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
  }, [announcementOpen, canSendAnnouncements, periodId])

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

  function resetAnnouncementSchedule() {
    setAnnouncementScheduleMode('now')
    setAnnouncementScheduleDate('')
    setAnnouncementScheduleHour('09')
    setAnnouncementScheduleMinute('00')
    setAnnouncementError(null)
  }

  function selectScheduledAnnouncement() {
    setAnnouncementScheduleMode('scheduled')
    setAnnouncementError(null)
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
    if (announcementScheduleMode === 'scheduled') {
      if (!announcementScheduleDate) {
        setAnnouncementError('Planlı gönderim için bir tarih seçmelisin.')
        return
      }
      const scheduledDate = new Date(
        `${announcementScheduleDate}T${announcementScheduleHour}:${announcementScheduleMinute}:00`,
      )
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
    resetAnnouncementSchedule()
  }

  const currentRoleLabel = roleLabel(appRole)

  return (
    <AppShell isSuperAdmin={isSuperAdmin} displayName={displayName} roleLabel={coordinatorRoleName ?? currentRoleLabel} onSignOut={() => void handleSignOut()}>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div>
          <p className="text-sm text-ink-soft">Hesap ayarları</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink">Hesabım ve Ayarlar</h1>
          <p className="mt-1 text-sm text-ink-soft">Hesap, güvenlik ve bildirim tercihlerini buradan yönet.</p>
        </div>

        {membershipLoading ? <p className="mt-6 text-sm text-ink-soft">Hesap bilgileri yükleniyor…</p> : (
          <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(18rem,.75fr)_minmax(0,1.25fr)]">
            <section className="overflow-hidden rounded-xl border border-canvas-border bg-canvas-surface shadow-card lg:sticky lg:top-8">
              <div className="bg-brand-dark px-5 py-6 text-white">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 text-lg font-semibold">{displayName.split(' ').map((part) => part[0]).join('').slice(0, 2).toLocaleUpperCase('tr-TR') || 'M'}</span>
                <h2 className="mt-4 break-words text-xl font-semibold">{displayName || 'Hesabım'}</h2>
                <p className="mt-1 text-sm text-white/75">{coordinatorRoleName ?? currentRoleLabel}</p>
              </div>
              <dl className="divide-y divide-canvas-border px-5 text-sm">
                {[
                  ['E-posta adresi', session.user.email ?? 'Belirtilmemiş'],
                  ['Görünen ad', displayName || 'Belirtilmemiş'],
                  ['Aktif dönem', periodLabel ?? 'Aktif üyelik yok'],
                  ['Uygulama rolü', currentRoleLabel],
                  ...(coordinatorRoleName ? [['Koordinatörlük', coordinatorRoleName]] : []),
                ].map(([label, value]) => <div key={label} className="py-3"><dt className="text-xs text-ink-soft">{label}</dt><dd className="mt-1 break-words font-medium text-ink">{value}</dd></div>)}
              </dl>
              <p className="mx-5 mb-5 rounded-lg border border-accent/20 bg-accent-soft/40 px-3 py-2 text-xs text-ink-soft">Görünen ad, geçmiş dönem kayıtlarının doğru kalması için dönem üyeliği üzerinden yönetilir.</p>
            </section>

            <div className="grid gap-5">
              <section className="rounded-xl border border-canvas-border bg-canvas-surface p-4 shadow-card sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-dark"><BellIcon /></span><div><h2 className="font-semibold text-ink">Mobil bildirimler</h2><p className="mt-1 text-sm text-ink-soft">Görev, son tarih ve önemli güncellemeleri cihazında al.</p></div></div>
                  {pushSupportState === 'supported' && (pushEnabled ? <button type="button" onClick={() => void handleDisablePush()} disabled={pushActionState === 'loading'} className="min-h-[44px] shrink-0 rounded-lg border border-canvas-border px-4 text-sm font-medium text-ink-soft disabled:opacity-60">{pushActionState === 'loading' ? 'Kapatılıyor…' : 'Bildirimleri kapat'}</button> : <button type="button" onClick={() => void handleEnablePush()} disabled={pushActionState === 'loading'} className="min-h-[44px] shrink-0 rounded-lg bg-accent px-4 text-sm font-semibold text-white disabled:opacity-60">{pushActionState === 'loading' ? 'Açılıyor…' : 'Bildirimleri aç'}</button>)}
                </div>
                <div className={`mt-4 rounded-lg px-3 py-2 text-sm ${pushEnabled ? 'bg-brand-soft text-brand-dark' : 'bg-canvas text-ink-soft'}`}>
                  {pushSupportState === 'unsupported' ? 'Bu tarayıcı mobil Web Push bildirimlerini desteklemiyor.' : pushSupportState === 'not_configured' ? 'Mobil bildirim yapılandırması henüz tamamlanmadı.' : pushEnabled ? 'Mobil bildirimler bu cihazda açık.' : 'iPhone’da kullanmak için siteyi Ana Ekrana Ekle ve izni bu düğmeden ver.'}
                </div>
                {pushError ? <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{pushError}</p> : null}
              </section>

              <section className="rounded-xl border border-canvas-border bg-canvas-surface p-4 shadow-card sm:p-5">
                <div className="flex gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-dark"><ShieldIcon /></span><div><h2 className="font-semibold text-ink">Güvenlik</h2><p className="mt-1 text-sm text-ink-soft">Hesabının oturum ve şifre ayarlarını yönet.</p></div></div>
                <Link to="/app/ayarlar/sifre" className="mt-4 flex min-h-[56px] items-center justify-between gap-3 rounded-lg border border-canvas-border bg-canvas px-4 text-sm transition hover:border-brand"><span><span className="block font-medium text-ink">Şifre değiştir</span><span className="mt-0.5 block text-xs text-ink-soft">Hesap şifreni güvenli biçimde güncelle.</span></span><span className="text-ink-soft"><ChevronIcon /></span></Link>
              </section>

              {canSendAnnouncements ? <section className="rounded-xl border border-canvas-border bg-canvas-surface p-4 shadow-card sm:p-5">
                <div className="flex gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-amber-800">{isSuperAdmin ? <TeamIcon /> : <MegaphoneIcon />}</span><div><h2 className="font-semibold text-ink">{isSuperAdmin ? 'Yönetim' : 'Duyuru yönetimi'}</h2><p className="mt-1 text-sm text-ink-soft">{isSuperAdmin ? 'Ekip yetkilerini düzenle veya genel duyuru gönder.' : 'Genel Sekreter yetkisiyle manuel bildirim gönder.'}</p></div></div>
                <div className={`mt-4 grid gap-3 ${isSuperAdmin ? 'sm:grid-cols-2' : ''}`}>
                  {isSuperAdmin ? <Link to="/app/yonetim/uyeler" className="flex min-h-[72px] items-center justify-between gap-3 rounded-lg border border-canvas-border bg-canvas px-4 text-sm transition hover:border-brand"><span><span className="block font-medium text-ink">Ekip ve yetki yönetimi</span><span className="mt-1 block text-xs text-ink-soft">Üyeleri ve rollerini yönet.</span></span><ChevronIcon /></Link> : null}
                  <button type="button" onClick={() => { setAnnouncementOpen(true); setAnnouncementMessage(null); setAnnouncementError(null) }} className="flex min-h-[72px] items-center justify-between gap-3 rounded-lg border border-canvas-border bg-canvas px-4 text-left text-sm transition hover:border-accent"><span><span className="block font-medium text-ink">Duyuru gönder</span><span className="mt-1 block text-xs text-ink-soft">Kişilere veya ekiplere bildir.</span></span><MegaphoneIcon /></button>
                </div>
              </section> : null}

              <section className="rounded-xl border border-danger/20 bg-canvas-surface p-4 shadow-card sm:p-5"><h2 className="font-semibold text-ink">Oturum</h2><p className="mt-1 text-sm text-ink-soft">Bu cihazdaki uygulama oturumunu sonlandır.</p><button type="button" onClick={() => void handleSignOut()} className="mt-4 min-h-[44px] rounded-lg border border-danger/25 px-4 text-sm font-medium text-danger hover:bg-danger-soft">Çıkış yap</button></section>
            </div>
          </div>
        )}
      </main>

      {canSendAnnouncements && announcementOpen ? <>
        <button type="button" aria-label="Duyuru panelini kapat" onClick={() => !announcementSubmitting && setAnnouncementOpen(false)} className="fixed inset-0 z-40 hidden bg-ink/45 backdrop-blur-[1px] lg:block" />
        <section role="dialog" aria-modal="true" aria-labelledby="announcement-title" className="fixed inset-0 z-50 flex flex-col bg-canvas-surface shadow-2xl lg:left-auto lg:w-[min(44rem,calc(100vw-15rem))]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <header className="flex items-center justify-between gap-3 border-b border-canvas-border px-4 py-4 sm:px-6"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent-soft text-amber-800"><MegaphoneIcon /></span><div><h2 id="announcement-title" className="font-semibold text-ink">Yeni duyuru</h2><p className="text-xs text-ink-soft">Uygulama ve mobil bildirim gönder.</p></div></div><button type="button" onClick={() => setAnnouncementOpen(false)} disabled={announcementSubmitting} className="min-h-[44px] rounded-lg border border-canvas-border px-3 text-sm font-medium text-ink-soft hover:bg-canvas disabled:opacity-60">Kapat</button></header>
          <form onSubmit={(event) => void handleSendAnnouncement(event)} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6"><p className="rounded-lg border border-accent/20 bg-accent-soft/40 px-3 py-2 text-xs text-ink-soft">Aktif Süper Yöneticiler, seçilen alıcı grubundan bağımsız olarak duyuruyu alır.</p><div className="mt-5 grid gap-4">
              <section className="rounded-xl border border-canvas-border bg-canvas p-4 sm:p-5">
                <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-amber-800"><MegaphoneIcon /></span><div><h3 className="text-sm font-semibold text-ink">Duyuru içeriği</h3><p className="mt-0.5 text-xs text-ink-soft">Başlık ve alıcılara iletilecek açıklama.</p></div></div>
                <div className="mt-4 grid gap-4">
                  <label className="grid gap-1.5 text-sm font-medium text-ink">Başlık<input value={announcementTitle} onChange={(event) => setAnnouncementTitle(event.target.value)} maxLength={120} required className={fieldClass} placeholder="Örn. Yarın bakım yapılacak" /></label>
                  <label className="grid gap-1.5 text-sm font-medium text-ink">Duyuru metni<textarea value={announcementBody} onChange={(event) => setAnnouncementBody(event.target.value)} maxLength={2000} required rows={5} className={`${fieldClass} resize-y`} placeholder="Göndermek istediğin açıklama" /></label>
                </div>
              </section>

              <section className="rounded-xl border border-canvas-border bg-canvas p-4 sm:p-5">
                <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand-dark"><TeamIcon /></span><div><h3 className="text-sm font-semibold text-ink">Alıcılar</h3><p className="mt-0.5 text-xs text-ink-soft">Duyurunun ulaşacağı ekip veya kişileri seçin.</p></div></div>
                <div className="mt-4 grid gap-4">
                  <label className="grid gap-1.5 text-sm font-medium text-ink">Alıcı grubu<select value={announcementAudience} onChange={(event) => setAnnouncementAudience(event.target.value as AnnouncementAudience)} className={fieldClass}><option value="everyone">Herkes</option><option value="coordinator_roles">Koordinatörlükler</option><option value="profiles">Belirli kişiler</option></select></label>
                  {announcementAudience === 'coordinator_roles' ? <div className="max-h-52 overflow-y-auto rounded-lg border border-canvas-border bg-canvas-surface p-2">{announcementLoading ? <p className="p-2 text-sm text-ink-soft">Koordinatörlükler yükleniyor…</p> : announcementRoleOptions.map((role) => <label key={role.id} className="flex min-h-[44px] items-center gap-2 rounded px-2 text-sm hover:bg-canvas"><input type="checkbox" checked={selectedAnnouncementRoleIds.includes(role.id)} onChange={() => toggleAnnouncementSelection(role.id, selectedAnnouncementRoleIds, setSelectedAnnouncementRoleIds)} className="h-4 w-4 accent-brand" />{role.name}</label>)}</div> : null}
                  {announcementAudience === 'profiles' ? <div className="max-h-64 overflow-y-auto rounded-lg border border-canvas-border bg-canvas-surface p-2">{announcementLoading ? <p className="p-2 text-sm text-ink-soft">Kişiler yükleniyor…</p> : announcementMemberOptions.map((member) => <label key={member.profileId} className="flex min-h-[52px] items-start gap-2 rounded px-2 py-2 text-sm hover:bg-canvas"><input type="checkbox" checked={selectedAnnouncementProfileIds.includes(member.profileId)} onChange={() => toggleAnnouncementSelection(member.profileId, selectedAnnouncementProfileIds, setSelectedAnnouncementProfileIds)} className="mt-1 h-4 w-4 accent-brand" /><span>{member.displayName}{member.coordinatorRoleName ? <span className="block text-xs text-ink-soft">{member.coordinatorRoleName}</span> : null}</span></label>)}</div> : null}
                </div>
              </section>

              <fieldset className="grid gap-3 rounded-xl border border-canvas-border bg-canvas p-4 sm:p-5">
                <legend className="px-1 text-sm font-semibold text-ink">Gönderim zamanı</legend>
                <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Gönderim zamanı">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={announcementScheduleMode === 'now'}
                    onClick={resetAnnouncementSchedule}
                    className={`flex min-h-[64px] items-center gap-3 rounded-xl border px-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${announcementScheduleMode === 'now' ? 'border-brand bg-brand-soft text-brand-dark' : 'border-canvas-border bg-canvas-surface text-ink hover:border-brand/40'}`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/80"><MegaphoneIcon /></span>
                    <span><span className="block text-sm font-semibold">Hemen gönder</span><span className="mt-0.5 block text-xs font-normal text-ink-soft">Formu gönderdiğinde yayınlanır.</span></span>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={announcementScheduleMode === 'scheduled'}
                    onClick={selectScheduledAnnouncement}
                    className={`flex min-h-[64px] items-center gap-3 rounded-xl border px-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${announcementScheduleMode === 'scheduled' ? 'border-accent bg-accent-soft/60 text-amber-900' : 'border-canvas-border bg-canvas-surface text-ink hover:border-accent/50'}`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/80"><ClockIcon /></span>
                    <span><span className="block text-sm font-semibold">Tarih ve saat seç</span><span className="mt-0.5 block text-xs font-normal text-ink-soft">Duyuruyu ileri bir zamana planla.</span></span>
                  </button>
                </div>

                {announcementScheduleMode === 'scheduled' ? (
                  <div className="rounded-xl border border-accent/25 bg-accent-soft/20 p-3 sm:p-4">
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
                      <label className="grid gap-1.5 text-sm font-medium text-ink">
                        <span className="inline-flex items-center gap-2"><CalendarIcon /> Tarih</span>
                        <input
                          type="date"
                          min={localDateValue()}
                          value={announcementScheduleDate}
                          onChange={(event) => setAnnouncementScheduleDate(event.target.value)}
                          className={`${fieldClass} w-full text-base`}
                        />
                      </label>
                      <div className="grid gap-1.5">
                        <span className="inline-flex items-center gap-2 text-sm font-medium text-ink"><ClockIcon /> Saat</span>
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                          <label className="sr-only" htmlFor="announcement-hour">Saat</label>
                          <select id="announcement-hour" value={announcementScheduleHour} onChange={(event) => setAnnouncementScheduleHour(event.target.value)} className={`${fieldClass} w-full text-center text-base font-semibold`}>
                            {announcementHours.map((hour) => <option key={hour} value={hour}>{hour}</option>)}
                          </select>
                          <span className="text-lg font-semibold text-ink-soft" aria-hidden="true">:</span>
                          <label className="sr-only" htmlFor="announcement-minute">Dakika</label>
                          <select id="announcement-minute" value={announcementScheduleMinute} onChange={(event) => setAnnouncementScheduleMinute(event.target.value)} className={`${fieldClass} w-full text-center text-base font-semibold`}>
                            {announcementMinutes.map((minute) => <option key={minute} value={minute}>{minute}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                    <button type="button" onClick={resetAnnouncementSchedule} className="mt-3 min-h-[44px] rounded-lg px-2 text-sm font-medium text-brand-dark hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                      Planı sıfırla ve hemen gönder
                    </button>
                  </div>
                ) : (
                  <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand-dark">Bu duyuru formu gönderdiğin anda alıcılara iletilecek.</p>
                )}
              </fieldset>
              {announcementError ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{announcementError}</p> : null}{announcementMessage ? <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{announcementMessage}</p> : null}
            </div></div>
            <footer className="border-t border-canvas-border px-4 py-4 sm:px-6" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}><button type="submit" disabled={announcementSubmitting || announcementLoading} className="min-h-[48px] w-full rounded-lg bg-accent px-5 text-sm font-semibold text-white disabled:opacity-60">{announcementSubmitting ? 'Gönderiliyor…' : announcementScheduleMode === 'scheduled' ? 'Duyuruyu planla' : 'Duyuruyu şimdi gönder'}</button></footer>
          </form>
        </section>
      </> : null}
    </AppShell>
  )
}
