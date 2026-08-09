import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useMembershipStatus } from '../hooks/useMembershipStatus'

interface StatusOption {
  slug: string
  label: string
}

interface MembershipRow {
  profile_id: string
  period_display_name: string
}

interface AwarenessRow {
  id: string
  awareness_name: string
  scope: string | null
  start_date: string | null
  end_date: string | null
  estimated_date: string | null
  share_date: string | null
  preparation_start_date: string | null
  closing_date: string | null
  design_status: string
  announcement_text_status: string
  sharing_status: string
  design_responsible_id: string | null
  press_publication_responsible_id: string | null
  record_check_status: string
  next_action: string | null
  note: string | null
  drive_folder_url: string | null
  design_url: string | null
  share_url: string | null
  created_by: string
  deleted_at: string | null
}

interface ProfileOption {
  id: string
  name: string
}

interface AwarenessPost {
  id: string
  awarenessName: string
  scope: string | null
  startDate: string | null
  endDate: string | null
  estimatedDate: string | null
  shareDate: string | null
  preparationStartDate: string | null
  closingDate: string | null
  designStatus: string
  announcementStatus: string
  sharingStatus: string
  designResponsibleId: string | null
  pressResponsibleId: string | null
  recordCheckStatus: string
  nextAction: string | null
  note: string | null
  driveFolderUrl: string | null
  designUrl: string | null
  shareUrl: string | null
  createdBy: string
  deletedAt: string | null
}

type FormMode = 'closed' | 'create' | 'edit'

function parseDateOnly(value: string | null): Date | null {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  if (![year, month, day].every(Number.isFinite)) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(value: string | null): string {
  const date = parseDateOnly(value)
  if (!date) return 'Belirtilmedi'
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function formatMonthYear(value: string | null): string {
  const date = parseDateOnly(value)
  if (!date) return 'Belirtilmedi'
  return new Intl.DateTimeFormat('tr-TR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function addDaysToDateOnly(value: string | null, days: number): string {
  const date = parseDateOnly(value)
  if (!date) return ''
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function isDelayed(shareDate: string | null, sharingStatus: string): boolean {
  if (!shareDate || sharingStatus === 'shared') return false
  const target = parseDateOnly(shareDate)
  if (!target) return false
  const today = new Date()
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  return target.getTime() < todayUtc
}

function isValidUrl(value: string): boolean {
  if (!value.trim()) return true
  return /^https?:\/\//i.test(value.trim())
}

function CenteredMessage({ text }: { text: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <p className="text-center text-sm text-ink-soft">{text}</p>
    </div>
  )
}

export default function AwarenessPosts({ session }: { session: Session }) {
  const { hasActiveMembership, profileId, periodId, periodLabel, appRole, loading: statusLoading } = useMembershipStatus(session)
  const isSuperAdmin = appRole === 'super_admin'
  const [posts, setPosts] = useState<AwarenessPost[]>([])
  const [profiles, setProfiles] = useState<ProfileOption[]>([])
  const [designStatuses, setDesignStatuses] = useState<StatusOption[]>([])
  const [announcementStatuses, setAnnouncementStatuses] = useState<StatusOption[]>([])
  const [sharingStatuses, setSharingStatuses] = useState<StatusOption[]>([])
  const [recordCheckStatuses, setRecordCheckStatuses] = useState<StatusOption[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [reloadKey, setReloadKey] = useState(0)
  const [showInactive, setShowInactive] = useState(false)
  const [formMode, setFormMode] = useState<FormMode>('closed')
  const [editingId, setEditingId] = useState<string | null>(null)

  const [awarenessName, setAwarenessName] = useState('')
  const [scope, setScope] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [estimatedDate, setEstimatedDate] = useState('')
  const [shareDate, setShareDate] = useState('')
  const [closingDate, setClosingDate] = useState('')
  const [designStatus, setDesignStatus] = useState('not_started')
  const [announcementStatus, setAnnouncementStatus] = useState('not_started')
  const [sharingStatus, setSharingStatus] = useState('not_shared')
  const [recordCheckStatus, setRecordCheckStatus] = useState('pending_check')
  const [designResponsibleId, setDesignResponsibleId] = useState('')
  const [pressResponsibleId, setPressResponsibleId] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [note, setNote] = useState('')
  const [driveFolderUrl, setDriveFolderUrl] = useState('')
  const [designUrl, setDesignUrl] = useState('')
  const [shareUrl, setShareUrl] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    if (statusLoading) return
    if (!hasActiveMembership || !periodId) {
      setLoadState('ready')
      return
    }

    let isMounted = true
    async function loadData() {
      setLoadState('loading')
      const [membersResult, designResult, announcementResult, sharingResult, checkResult] = await Promise.all([
        supabase.from('period_memberships').select('profile_id, period_display_name').eq('period_id', periodId).eq('is_active', true),
        supabase.from('awareness_design_statuses').select('slug, label').eq('is_active', true).order('sort_order'),
        supabase.from('awareness_announcement_statuses').select('slug, label').eq('is_active', true).order('sort_order'),
        supabase.from('awareness_sharing_statuses').select('slug, label').eq('is_active', true).order('sort_order'),
        supabase.from('awareness_record_check_statuses').select('slug, label').eq('is_active', true).order('sort_order'),
      ])

      if (!isMounted) return
      if (membersResult.error || designResult.error || announcementResult.error || sharingResult.error || checkResult.error) {
        setLoadState('error')
        return
      }

      const membershipRows = (membersResult.data ?? []) as unknown as MembershipRow[]
      setProfiles(membershipRows.map((member) => ({
        id: member.profile_id,
        name: member.period_display_name || 'İsimsiz',
      })))
      setDesignStatuses((designResult.data ?? []) as unknown as StatusOption[])
      setAnnouncementStatuses((announcementResult.data ?? []) as unknown as StatusOption[])
      setSharingStatuses((sharingResult.data ?? []) as unknown as StatusOption[])
      setRecordCheckStatuses((checkResult.data ?? []) as unknown as StatusOption[])

      let query = supabase
        .from('awareness_posts')
        .select('*')
        .eq('period_id', periodId)
        .order('start_date', { ascending: true, nullsFirst: false })
        .order('share_date', { ascending: true, nullsFirst: false })
      if (!showInactive) query = query.is('deleted_at', null)

      const postsResult = await query
      if (!isMounted) return
      if (postsResult.error) {
        setLoadState('error')
        return
      }

      const rows = (postsResult.data ?? []) as unknown as AwarenessRow[]
      setPosts(rows.map((row) => ({
        id: row.id,
        awarenessName: row.awareness_name,
        scope: row.scope,
        startDate: row.start_date,
        endDate: row.end_date,
        estimatedDate: row.estimated_date,
        shareDate: row.share_date,
        preparationStartDate: row.preparation_start_date,
        closingDate: row.closing_date,
        designStatus: row.design_status,
        announcementStatus: row.announcement_text_status,
        sharingStatus: row.sharing_status,
        designResponsibleId: row.design_responsible_id,
        pressResponsibleId: row.press_publication_responsible_id,
        recordCheckStatus: row.record_check_status,
        nextAction: row.next_action,
        note: row.note,
        driveFolderUrl: row.drive_folder_url,
        designUrl: row.design_url,
        shareUrl: row.share_url,
        createdBy: row.created_by,
        deletedAt: row.deleted_at,
      })))
      setLoadState('ready')
    }

    void loadData()
    return () => {
      isMounted = false
    }
  }, [hasActiveMembership, periodId, reloadKey, showInactive, statusLoading])

  function resetForm() {
    setAwarenessName('')
    setScope('')
    setStartDate('')
    setEndDate('')
    setEstimatedDate('')
    setShareDate('')
    setClosingDate('')
    setDesignStatus('not_started')
    setAnnouncementStatus('not_started')
    setSharingStatus('not_shared')
    setRecordCheckStatus('pending_check')
    setDesignResponsibleId('')
    setPressResponsibleId('')
    setNextAction('')
    setNote('')
    setDriveFolderUrl('')
    setDesignUrl('')
    setShareUrl('')
    setEditingId(null)
    setFormError(null)
  }

  function openCreate() {
    resetForm()
    setFormMode('create')
    setSuccessMessage(null)
  }

  function openEdit(post: AwarenessPost) {
    setEditingId(post.id)
    setAwarenessName(post.awarenessName)
    setScope(post.scope ?? '')
    setStartDate(post.startDate ?? '')
    setEndDate(post.endDate ?? '')
    setEstimatedDate(post.estimatedDate ?? '')
    setShareDate(post.shareDate ?? '')
    setClosingDate(post.closingDate ?? '')
    setDesignStatus(post.designStatus)
    setAnnouncementStatus(post.announcementStatus)
    setSharingStatus(post.sharingStatus)
    setRecordCheckStatus(post.recordCheckStatus)
    setDesignResponsibleId(post.designResponsibleId ?? '')
    setPressResponsibleId(post.pressResponsibleId ?? '')
    setNextAction(post.nextAction ?? '')
    setNote(post.note ?? '')
    setDriveFolderUrl(post.driveFolderUrl ?? '')
    setDesignUrl(post.designUrl ?? '')
    setShareUrl(post.shareUrl ?? '')
    setFormError(null)
    setSuccessMessage(null)
    setFormMode('edit')
  }

  async function handleSave() {
    if (!periodId || !profileId) return
    setFormError(null)
    if (!awarenessName.trim()) {
      setFormError('Farkındalık adı zorunludur.')
      return
    }
    if (startDate && endDate && startDate > endDate) {
      setFormError('Başlangıç günü, bitiş gününden sonra olamaz.')
      return
    }
    if (![driveFolderUrl, designUrl, shareUrl].every(isValidUrl)) {
      setFormError('Linkler http:// veya https:// ile başlamalıdır.')
      return
    }

    setIsSaving(true)
    const payload = {
      awareness_name: awarenessName.trim(),
      scope: scope.trim() || null,
      start_date: startDate || null,
      end_date: endDate || null,
      estimated_date: estimatedDate || null,
      share_date: shareDate || null,
      closing_date: closingDate || null,
      design_status: designStatus,
      announcement_text_status: announcementStatus,
      sharing_status: sharingStatus,
      record_check_status: recordCheckStatus,
      design_responsible_id: designResponsibleId || null,
      press_publication_responsible_id: pressResponsibleId || null,
      next_action: nextAction.trim() || null,
      note: note.trim() || null,
      drive_folder_url: driveFolderUrl.trim() || null,
      design_url: designUrl.trim() || null,
      share_url: shareUrl.trim() || null,
    }

    const result = formMode === 'create'
      ? await supabase.from('awareness_posts').insert({ period_id: periodId, created_by: profileId, ...payload })
      : await supabase.from('awareness_posts').update(payload).eq('id', editingId)

    setIsSaving(false)
    if (result.error) {
      const message = result.error.message.toLowerCase()
      setFormError(message.includes('kilit') ? 'Dönem kilitli olduğu için işlem yapılamaz.' : 'Kayıt kaydedilemedi. Yetki ve tarih bilgilerini kontrol edin.')
      return
    }

    setFormMode('closed')
    setSuccessMessage(formMode === 'create' ? 'Farkındalık başarıyla eklendi.' : 'Farkındalık başarıyla güncellendi.')
    setReloadKey((value) => value + 1)
  }

  async function toggleActive(post: AwarenessPost) {
    if (!profileId) return
    const isDeactivating = !post.deletedAt
    if (isDeactivating && !window.confirm('Bu kaydı pasifleştirmek istediğinize emin misiniz?')) return

    const result = await supabase
      .from('awareness_posts')
      .update(isDeactivating
        ? { deleted_at: new Date().toISOString(), deleted_by: profileId, deletion_note: 'Kullanıcı pasifleştirdi' }
        : { deleted_at: null, deleted_by: null, deletion_note: null })
      .eq('id', post.id)

    if (result.error) {
      setSuccessMessage(result.error.message.toLowerCase().includes('kilit') ? 'Dönem kilitli olduğu için işlem yapılamadı.' : 'Kayıt güncellenemedi.')
      return
    }
    setSuccessMessage(isDeactivating ? 'Kayıt pasifleştirildi.' : 'Kayıt yeniden aktifleştirildi.')
    setReloadKey((value) => value + 1)
  }

  function getStatusLabel(slug: string, options: StatusOption[]): string {
    return options.find((option) => option.slug === slug)?.label ?? 'Belirtilmedi'
  }

  function getProfileName(id: string | null): string {
    return profiles.find((profile) => profile.id === id)?.name ?? 'Atanmamış'
  }

  if (statusLoading || loadState === 'loading') return <CenteredMessage text="Farkındalık paylaşımları yükleniyor…" />
  if (!hasActiveMembership) return <CenteredMessage text="Bu sayfaya erişim yetkin yok." />
  if (loadState === 'error') return <CenteredMessage text="Farkındalık paylaşımları yüklenirken bir hata oluştu." />

  return (
    <div className="min-h-screen bg-canvas pb-12">
      <header className="border-b border-canvas-border bg-canvas-surface">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link to="/app" className="text-sm font-semibold text-ink">MUPSA Ekip Koordinasyon</Link>
          <Link to="/app" className="text-sm font-medium text-ink-soft">Ana sayfa</Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-sm text-ink-soft">{periodLabel ? `Aktif dönem: ${periodLabel}` : 'Aktif dönem'}</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-ink">Farkındalık Paylaşımları</h1>
          {formMode === 'closed' && (
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-soft">
                <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} className="rounded border-canvas-border text-ink focus:ring-ink" />
                Pasifleri göster
              </label>
              <button type="button" onClick={openCreate} className="rounded-lg bg-accent-soft px-3 py-2 text-sm font-medium text-ink">Yeni kayıt</button>
            </div>
          )}
        </div>

        {successMessage && <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{successMessage}</p>}

        {formMode !== 'closed' && (
          <section className="mt-4 rounded-lg border border-canvas-border bg-canvas-surface p-4 shadow-card">
            <div className="mb-4 flex items-center justify-between border-b border-canvas-border pb-3">
              <h2 className="text-sm font-semibold text-ink">{formMode === 'create' ? 'Yeni farkındalık' : 'Farkındalığı düzenle'}</h2>
              <button type="button" onClick={() => setFormMode('closed')} className="text-xs font-medium text-ink-soft">Kapat</button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm"><span className="font-medium text-ink">Farkındalık adı *</span><input value={awarenessName} onChange={(event) => setAwarenessName(event.target.value)} disabled={isSaving} className="rounded border border-canvas-border px-3 py-2" /></label>
              <label className="flex flex-col gap-1 text-sm"><span className="font-medium text-ink">Kapsam</span><input value={scope} onChange={(event) => setScope(event.target.value)} disabled={isSaving} className="rounded border border-canvas-border px-3 py-2" /></label>
              <label className="flex flex-col gap-1 text-sm"><span className="font-medium text-ink">Başlangıç günü</span><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} disabled={isSaving} className="rounded border border-canvas-border px-3 py-2" /></label>
              <label className="flex flex-col gap-1 text-sm"><span className="font-medium text-ink">Bitiş günü</span><input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} disabled={isSaving} className="rounded border border-canvas-border px-3 py-2" /></label>
              <label className="flex flex-col gap-1 text-sm"><span className="font-medium text-ink">Paylaşım tarihi</span><input type="date" value={shareDate} onChange={(event) => setShareDate(event.target.value)} disabled={isSaving} className="rounded border border-canvas-border px-3 py-2" /></label>
              <label className="flex flex-col gap-1 text-sm"><span className="font-medium text-ink">Tahmini paylaşım tarihi</span><input type="date" value={estimatedDate} onChange={(event) => setEstimatedDate(event.target.value)} disabled={isSaving} className="rounded border border-canvas-border px-3 py-2" /></label>
              <label className="flex flex-col gap-1 text-sm opacity-70"><span className="font-medium text-ink">Hazırlığa başlangıç (otomatik)</span><input type="date" value={shareDate ? addDaysToDateOnly(shareDate, -14) : addDaysToDateOnly(estimatedDate, -14)} disabled className="cursor-not-allowed rounded border border-canvas-border bg-canvas px-3 py-2" /></label>
              <label className="flex flex-col gap-1 text-sm"><span className="font-medium text-ink">Kapanış tarihi</span><input type="date" value={closingDate} onChange={(event) => setClosingDate(event.target.value)} disabled={isSaving} className="rounded border border-canvas-border px-3 py-2" /></label>
              <label className="flex flex-col gap-1 text-sm"><span className="font-medium text-ink">Tasarım durumu</span><select value={designStatus} onChange={(event) => setDesignStatus(event.target.value)} disabled={isSaving} className="rounded border border-canvas-border bg-white px-3 py-2">{designStatuses.map((option) => <option key={option.slug} value={option.slug}>{option.label}</option>)}</select></label>
              <label className="flex flex-col gap-1 text-sm"><span className="font-medium text-ink">Duyuru metni durumu</span><select value={announcementStatus} onChange={(event) => setAnnouncementStatus(event.target.value)} disabled={isSaving} className="rounded border border-canvas-border bg-white px-3 py-2">{announcementStatuses.map((option) => <option key={option.slug} value={option.slug}>{option.label}</option>)}</select></label>
              <label className="flex flex-col gap-1 text-sm"><span className="font-medium text-ink">Paylaşım durumu</span><select value={sharingStatus} onChange={(event) => setSharingStatus(event.target.value)} disabled={isSaving} className="rounded border border-canvas-border bg-white px-3 py-2">{sharingStatuses.map((option) => <option key={option.slug} value={option.slug}>{option.label}</option>)}</select></label>
              <label className="flex flex-col gap-1 text-sm"><span className="font-medium text-ink">Kayıt kontrolü</span><select value={recordCheckStatus} onChange={(event) => setRecordCheckStatus(event.target.value)} disabled={isSaving} className="rounded border border-canvas-border bg-white px-3 py-2">{recordCheckStatuses.map((option) => <option key={option.slug} value={option.slug}>{option.label}</option>)}</select></label>
              <label className="flex flex-col gap-1 text-sm"><span className="font-medium text-ink">Tasarım sorumlusu</span><select value={designResponsibleId} onChange={(event) => setDesignResponsibleId(event.target.value)} disabled={isSaving} className="rounded border border-canvas-border bg-white px-3 py-2"><option value="">Seçiniz</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label>
              <label className="flex flex-col gap-1 text-sm"><span className="font-medium text-ink">Basın Yayın sorumlusu</span><select value={pressResponsibleId} onChange={(event) => setPressResponsibleId(event.target.value)} disabled={isSaving} className="rounded border border-canvas-border bg-white px-3 py-2"><option value="">Seçiniz</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label>
              <label className="flex flex-col gap-1 text-sm md:col-span-2"><span className="font-medium text-ink">Sonraki aksiyon</span><input value={nextAction} onChange={(event) => setNextAction(event.target.value)} disabled={isSaving} className="rounded border border-canvas-border px-3 py-2" /></label>
              <label className="flex flex-col gap-1 text-sm md:col-span-2"><span className="font-medium text-ink">Not</span><textarea value={note} onChange={(event) => setNote(event.target.value)} disabled={isSaving} rows={3} className="rounded border border-canvas-border px-3 py-2" /></label>
              <label className="flex flex-col gap-1 text-sm"><span className="font-medium text-ink">Drive klasör linki</span><input type="url" value={driveFolderUrl} onChange={(event) => setDriveFolderUrl(event.target.value)} disabled={isSaving} className="rounded border border-canvas-border px-3 py-2" /></label>
              <label className="flex flex-col gap-1 text-sm"><span className="font-medium text-ink">Tasarım linki</span><input type="url" value={designUrl} onChange={(event) => setDesignUrl(event.target.value)} disabled={isSaving} className="rounded border border-canvas-border px-3 py-2" /></label>
              <label className="flex flex-col gap-1 text-sm"><span className="font-medium text-ink">Paylaşım linki</span><input type="url" value={shareUrl} onChange={(event) => setShareUrl(event.target.value)} disabled={isSaving} className="rounded border border-canvas-border px-3 py-2" /></label>
            </div>

            {formError && <p className="mt-4 text-sm text-red-600">{formError}</p>}
            <div className="mt-6 flex items-center gap-3">
              <button type="button" onClick={() => void handleSave()} disabled={isSaving} className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-canvas-surface">{isSaving ? 'Kaydediliyor…' : 'Kaydet'}</button>
              <button type="button" onClick={() => setFormMode('closed')} disabled={isSaving} className="rounded-lg border border-canvas-border px-4 py-2 text-sm text-ink-soft">İptal</button>
            </div>
          </section>
        )}

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {posts.length === 0 ? <p className="text-sm italic text-ink-soft">Bu dönemde henüz farkındalık eklenmemiş.</p> : posts.map((post) => {
            const canEdit = isSuperAdmin || (profileId !== null && (post.createdBy === profileId || post.designResponsibleId === profileId || post.pressResponsibleId === profileId))
            const isDelayedPost = isDelayed(post.shareDate, post.sharingStatus)
            return (
              <article key={post.id} className={`rounded-lg border p-4 shadow-card ${post.deletedAt ? 'border-red-200 bg-red-50/50' : 'border-canvas-border bg-canvas-surface'}`}>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="line-clamp-2 font-semibold text-ink">{post.awarenessName}</h2>
                  {isDelayedPost && <span className="shrink-0 rounded bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">Gecikti</span>}
                </div>
                {post.scope && <p className="mt-1 line-clamp-2 text-xs text-ink-soft">{post.scope}</p>}
                <dl className="mt-4 grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                  <dt className="font-medium text-ink-soft">Ay</dt><dd className="text-ink">{formatMonthYear(post.shareDate ?? post.startDate)}</dd>
                  <dt className="font-medium text-ink-soft">Tarih aralığı</dt><dd className="text-ink">{formatDate(post.startDate)} – {formatDate(post.endDate)}</dd>
                  <dt className="font-medium text-ink-soft">Paylaşım</dt><dd className="text-ink">{formatDate(post.shareDate)}</dd>
                  <dt className="font-medium text-ink-soft">Hazırlık başlangıcı</dt><dd className="text-ink">{formatDate(post.preparationStartDate)}</dd>
                  <dt className="font-medium text-ink-soft">Kapanış</dt><dd className="text-ink">{formatDate(post.closingDate)}</dd>
                </dl>
                <dl className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1 border-t border-canvas-border pt-3 text-xs">
                  <dt className="text-ink-soft">Tasarım</dt><dd className="font-medium text-ink">{getStatusLabel(post.designStatus, designStatuses)}</dd>
                  <dt className="text-ink-soft">Duyuru</dt><dd className="font-medium text-ink">{getStatusLabel(post.announcementStatus, announcementStatuses)}</dd>
                  <dt className="text-ink-soft">Paylaşım</dt><dd className="font-medium text-ink">{getStatusLabel(post.sharingStatus, sharingStatuses)}</dd>
                  <dt className="text-ink-soft">Kayıt kontrolü</dt><dd className="font-medium text-ink">{getStatusLabel(post.recordCheckStatus, recordCheckStatuses)}</dd>
                </dl>
                <p className="mt-3 border-t border-canvas-border pt-3 text-xs text-ink-soft">Tasarım: {getProfileName(post.designResponsibleId)} · Basın Yayın: {getProfileName(post.pressResponsibleId)}</p>
                {post.nextAction && <p className="mt-2 text-xs text-ink-soft"><span className="font-medium text-ink">Sonraki aksiyon:</span> {post.nextAction}</p>}
                {post.note && <p className="mt-2 whitespace-pre-wrap text-xs text-ink-soft"><span className="font-medium text-ink">Not:</span> {post.note}</p>}
                <div className="mt-3 flex flex-wrap gap-3 text-xs">
                  {post.driveFolderUrl && <a href={post.driveFolderUrl} target="_blank" rel="noreferrer" className="font-medium text-ink underline">Drive</a>}
                  {post.designUrl && <a href={post.designUrl} target="_blank" rel="noreferrer" className="font-medium text-ink underline">Tasarım</a>}
                  {post.shareUrl && <a href={post.shareUrl} target="_blank" rel="noreferrer" className="font-medium text-ink underline">Paylaşım</a>}
                </div>
                {canEdit && (
                  <div className="mt-4 flex items-center gap-3 border-t border-canvas-border pt-3">
                    {!post.deletedAt && <button type="button" onClick={() => openEdit(post)} className="text-xs font-medium text-ink-soft underline decoration-dotted">Düzenle</button>}
                    <button type="button" onClick={() => void toggleActive(post)} className={`text-xs font-medium underline decoration-dotted ${post.deletedAt ? 'text-green-700' : 'text-red-600'}`}>{post.deletedAt ? 'Yeniden aktifleştir' : 'Pasifleştir'}</button>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </main>
    </div>
  )
}
